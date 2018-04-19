import datetime
import getpass
import re
import subprocess
import sys
import time

from base64 import b64encode
from os.path import expanduser

import boto3



BDM = [
    {
        'DeviceName': '/dev/sda1',
        'Ebs': {
            'VolumeSize': 200,
            'VolumeType': 'gp2',
            'DeleteOnTermination': True
        }
    },
    {
        'DeviceName': '/dev/sdb',
        'NoDevice': "",
    },
    {
        'DeviceName': '/dev/sdc',
        'NoDevice': "",
    },
]


class SpotClient(object):
    error_list = [
        'capacity-not-available',
        'capacity-oversubscribed',
        'not-scheduled-yet',
        'launch-group-constraint',
        'az-group-constraint',
        'placement-group-constraint',
        'constraint-not-fulfillable'
    ]
    instance_filters = [
        {
            'Name': 'availability-zone',
            'Values': [
                'us-west-2a',
                'us-west-2b',
                'us-west-2c'
            ],
        },
    ]

    def __init__(self, client, image_id, instance_type, security_groups):
        self.client = client
        self.image_id = image_id
        self.instance_type = instance_type
        self.security_groups = list(security_groups)
        self.spot_id = None


    def override_for_waiting(self, code_status):
        waiting = self.client.describe_spot_instance_requests(
            SpotInstanceRequestIds=[self.spot_id]
        )
        waiting_items_gen = (
            value
            for key, value in waiting.items()
            if key == 'SpotPriceHistory'
        )
        status_items_gen = (
            status_item
            for wait_item in waiting_items_gen
            for status_item in wait_item
            if status_item == 'Status'
        )
        for status_item in status_items_gen:
            for item in status_item:
                if item == 'Code':
                    code_status = item
        return code_status

    def request_spot_instance(self, iam_role, spot_price, user_data):
        instance = self.client.request_spot_instances(
            DryRun=False,
            SpotPrice=spot_price,
            InstanceCount=1,
            Type='one-time',
            LaunchSpecification={
                'ImageId': self.image_id,
                'SecurityGroups': self.security_groups,
                'UserData': user_data,
                'InstanceType': self.instance_type,
                'Placement': {
                    'AvailabilityZone': 'us-west-2c'
                },
                'BlockDeviceMappings': BDM,
                'IamInstanceProfile': {
                    "Name": iam_role,
                }
            }
        )
        self.spot_id = instance['SpotInstanceRequests'][0]['SpotInstanceRequestId']
        print("waiting for spot request to be fulfilled")
        code_status = self.wait_for_code_change()
        if not code_status == 'fufilled':
            code_status = self.wait_for_code_change()
        return instance

    def get_instance_id(self):
        request = self.client.describe_spot_instance_requests(
            SpotInstanceRequestIds=[self.spot_id])
        instance_id = request['SpotInstanceRequests'][0]['InstanceId']
        # print("\n Instace ID: %s" % instance_id)
        return instance_id

    def get_spot_code(self):
        request = self.client.describe_spot_instance_requests(
            SpotInstanceRequestIds=[self.spot_id]
        )
        code_status_start = request['SpotInstanceRequests'][0]['Status']
        return code_status_start['Code']

    def wait_for_code_change(self):
        code_status = None
        while code_status != 'fulfilled':
            code_status = self.get_spot_code()
            if code_status == self.error_cleanup(code_status):
                exit()
            code_status = self.override_for_waiting(code_status)
            if code_status == 'price-too-low':
                print("Spot Instance ERROR: Bid placed is too low.")
                self.cancel_spot()
                exit()
            time.sleep(0.1)
            return code_status

    def tag_spot_instance(self, tag_data, elasticsearch, cluster_name):
        tags = [
            {'Key': 'Name', 'Value': tag_data['name']},
            {'Key': 'branch', 'Value': tag_data['branch']},
            {'Key': 'commit', 'Value': tag_data['commit']},
            {'Key': 'started_by', 'Value': tag_data['username']},
        ]
        if elasticsearch == 'yes':
            tags.append({'Key': 'elasticsearch', 'Value': elasticsearch})
        if cluster_name is not None:
            tags.append({'Key': 'ec_cluster_name', 'Value': cluster_name})
        instance_id = self.client.create_tags(
            Resources=[self.get_instance_id()],
            Tags=tags
        )
        return instance_id

    def error_cleanup(self, code_status):
        if code_status in self.error_list:
            print('Spot Instance ERROR: %s' % code_status)
            self.cancel_spot()
            exit()

    def cancel_spot(self):
        self.client.cancel_spot_instance_requests(SpotInstanceRequestIds=[self.spot_id])

    def spot_instance_price_check(self):
        todays_date = datetime.datetime.now()
        response = self.client.describe_spot_price_history(
            DryRun=False,
            StartTime=todays_date,
            EndTime=todays_date,
            InstanceTypes=[
                self.instance_type
            ],
            Filters=self.instance_filters
        )
        response_items_gen = (
            value
            for key, value in response.items()
            if key == 'SpotPriceHistory'
        )
        highest = 0
        for value in response_items_gen:
            for item in value:
                for i in item:
                    if i == 'SpotPrice':
                        print("SpotPrice: %s" % item[i])
                        if float(item[i]) > highest:
                            highest = float(item[i])
        print("Highest price: %f" % highest)
        return highest


def nameify(in_str):
    name = ''.join(
        c if c.isalnum() else '-'
        for c in in_str.lower()
    ).strip('-')
    return re.subn(r'\-+', '-', name)[0]


def tag_ec2_instance(instance, tag_data, elasticsearch, cluster_name):
    tags = [
        {'Key': 'Name', 'Value': tag_data['name']},
        {'Key': 'branch', 'Value': tag_data['branch']},
        {'Key': 'commit', 'Value': tag_data['commit']},
        {'Key': 'started_by', 'Value': tag_data['username']},
    ]
    if elasticsearch == 'yes':
        tags.append({'Key': 'elasticsearch', 'Value': elasticsearch})
    if cluster_name is not None:
        tags.append({'Key': 'ec_cluster_name', 'Value': cluster_name})
    instance.create_tags(Tags=tags)
    return instance


def read_ssh_key():
    home = expanduser("~")
    ssh_key_path = home + '/' + '.ssh/id_rsa.pub'
    ssh_keygen_args = ['ssh-keygen', '-l', '-f', ssh_key_path]
    fingerprint = subprocess.check_output(
        ssh_keygen_args
    ).decode('utf-8').strip()
    if fingerprint:
        with open(ssh_key_path, 'r') as key_file:
            ssh_pub_key = key_file.readline().strip()
            return ssh_pub_key
    return None


def get_user_data(commit, config_file, data_insert, profile_name):
    cmd_list = ['git', 'show', commit + config_file]
    config_template = subprocess.check_output(cmd_list).decode('utf-8')
    ssh_pub_key = read_ssh_key()
    if not ssh_pub_key:
        print(
            "WARNING: User is not authorized with ssh access to "
            "new instance because they have no ssh key"
        )
    data_insert['LOCAL_SSH_KEY'] = ssh_pub_key
    # aws s3 authorized_keys folder
    auth_base = 's3://encoded-conf-prod/ssh-keys'
    auth_type = 'prod'
    if profile_name != 'production':
        auth_type = 'demo'
    auth_keys_dir = '{auth_base}/{auth_type}-authorized_keys'.format(
        auth_base=auth_base,
        auth_type=auth_type,
    )
    data_insert['S3_AUTH_KEYS'] = auth_keys_dir
    user_data = config_template % data_insert
    return user_data


def run(wale_s3_prefix, image_id, instance_type, elasticsearch, spot_instance,
        spot_price, cluster_size, cluster_name, check_price,
        branch=None, name=None, role='demo', profile_name=None
       ):
    # pylint: disable=too-many-arguments, too-many-locals, too-many-branches, too-many-statements
    if branch is None:
        branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD']).decode('utf-8').strip()

    commit = subprocess.check_output(['git', 'rev-parse', '--short', branch]).decode('utf-8').strip()
    if not subprocess.check_output(['git', 'branch', '-r', '--contains', commit]).strip():
        print("Commit %r not in origin. Did you git push?" % commit)
        sys.exit(1)

    username = getpass.getuser()

    if name is None:
        name = nameify('%s-%s-%s' % (branch, commit, username))
        if elasticsearch == 'yes':
            name = 'elasticsearch-' + name

    session = boto3.Session(region_name='us-west-2', profile_name=profile_name)
    ec2 = session.resource('ec2')

    domain = 'production' if profile_name == 'production' else 'instance'

    if any(ec2.instances.filter(
            Filters=[
                {'Name': 'tag:Name', 'Values': [name]},
                {'Name': 'instance-state-name',
                 'Values': ['pending', 'running', 'stopping', 'stopped']},
            ])):
        print('An instance already exists with name: %s' % name)
        sys.exit(1)

    if not elasticsearch == 'yes':
        if cluster_name:
            config_file = ':cloud-config-cluster.yml'
        else:
            config_file = ':cloud-config.yml'
        data_insert = {
            'WALE_S3_PREFIX': wale_s3_prefix,
            'COMMIT': commit,
            'ROLE': role,
        }
        if cluster_name:
            data_insert['CLUSTER_NAME'] = cluster_name
        user_data = get_user_data(commit, config_file, data_insert, profile_name)
        security_groups = ['ssh-http-https']
        iam_role = 'encoded-instance'
        count = 1
    else:
        if not cluster_name:
            print("Cluster must have a name")
            sys.exit(1)
        config_file = ':cloud-config-elasticsearch.yml'
        data_insert = {
            'CLUSTER_NAME': cluster_name,
        }
        user_data = get_user_data(commit, config_file, data_insert, profile_name)
        security_groups = ['elasticsearch-https']
        iam_role = 'elasticsearch-instance'
        count = int(cluster_size)

    boto_client = boto3.client('ec2')
    if check_price:
        spot_client = SpotClient(boto_client, image_id, instance_type, security_groups)
        spot_client.spot_instance_price_check()
        exit()

    if spot_instance:
        print("spot_instance check worked")
        # issue with base64 encoding so no decoding in utc-8 and recoding in base64 then decoding in base 64.
        config_file = ':cloud-config.yml'
        user_config = subprocess.check_output(['git', 'show', commit + ':cloud-config.yml'])
        user_data_b64 = b64encode(user_config)
        user_data = user_data_b64.decode()
        spot_client = SpotClient(boto_client, image_id, instance_type, security_groups)
        print("security_groups: %s" % security_groups)
        instances = spot_client.request_spot_instance(iam_role, spot_price, user_data)
    else:
        instances = boto_client.create_instances(
            ImageId=image_id,
            MinCount=count,
            MaxCount=count,
            InstanceType=instance_type,
            SecurityGroups=security_groups,
            UserData=user_data,
            BlockDeviceMappings=BDM,
            InstanceInitiatedShutdownBehavior='terminate',
            IamInstanceProfile={
                "Name": iam_role,
            }
        )

    for i, instance in enumerate(instances):
        if elasticsearch == 'yes' and count > 1:
            print('Creating Elasticsearch cluster')
            tmp_name = "{}{}".format(name, i)
        else:
            tmp_name = name

        if not spot_instance:
            print('%s.%s.encodedcc.org' % (instance.id, domain))  # Instance:i-34edd56f
            instance.wait_until_exists()
            tag_data = {
                'branch': branch,
                'commit': commit,
                'name': tmp_name,
                'username': username,
            }
            tag_ec2_instance(instance, tag_data, elasticsearch, cluster_name)
            print('ssh %s.%s.encodedcc.org' % (tmp_name, domain))
            if domain == 'instance':
                print('https://%s.demo.encodedcc.org' % tmp_name)

    if spot_instance:
        tag_data = {
            'branch': branch,
            'commit': commit,
            'name': tmp_name,
            'username': username,
        }
        spot_client.tag_spot_instance(tag_data, elasticsearch, cluster_name)
        print("Spot instance request had been completed, please check to be sure it was fufilled")


def main():
    import argparse

    def hostname(value):
        if value != nameify(value):
            raise argparse.ArgumentTypeError(
                "%r is an invalid hostname, only [a-z0-9] and hyphen allowed." % value)
        return value

    parser = argparse.ArgumentParser(
        description="Deploy ENCODE on AWS",
    )
    parser.add_argument('-b', '--branch', default=None, help="Git branch or tag")
    parser.add_argument('-n', '--name', type=hostname, help="Instance name")
    parser.add_argument('--wale-s3-prefix', default='s3://encoded-backups-prod/production')
    parser.add_argument('--spot-instance', action='store_true', help="Launch as spot instance")
    parser.add_argument('--spot-price', default='0.70', help="Set price or keep default price of 0.70")
    parser.add_argument('--check-price', action='store_true', help="Check price on spot instances")
    parser.add_argument(
        '--candidate', action='store_const', default='demo', const='candidate', dest='role',
        help="Deploy candidate instance")
    parser.add_argument(
        '--test', action='store_const', default='demo', const='test', dest='role',
        help="Deploy to production AWS")
    parser.add_argument(
        '--image-id', default='ami-2133bc59',
        help="https://us-west-2.console.aws.amazon.com/ec2/home?region=us-west-2#LaunchInstanceWizard:ami=ami-2133bc59")
    parser.add_argument(
        '--instance-type', default='c5.9xlarge',
        help="(defualts to c5.9xlarge for indexing) Switch to a smaller instance afterwards"
        "(m5.xlarge or c5.xlarge).")
    parser.add_argument('--profile-name', default=None, help="AWS creds profile")
    parser.add_argument('--elasticsearch', default=None, help="Launch an Elasticsearch instance")
    parser.add_argument('--cluster-size', default=2, help="Elasticsearch cluster size")
    parser.add_argument('--teardown-cluster', default=None, help="Takes down all the cluster launched from the branch")
    parser.add_argument('--cluster-name', default=None, help="Name of the cluster")
    args = parser.parse_args()

    return run(**vars(args))


if __name__ == '__main__':
    main()
