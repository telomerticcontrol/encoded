import sys
import boto3

from .deploy import (
    parse_args,
    nameify,
    tag_ec2_instance,
    read_ssh_key,
    get_bdm,
    get_instances_tag_data,
    get_ec2_client,
    _wait_and_tag_instances,
    get_run_args,
)


def main():
    # Gather Info
    main_args = parse_args()
    for item in [
            'check_price',
            'cluster_name',
            'cluster_size',
            'elasticsearch',
            'es_ip',
            'es_port',
            'no_es',
            'set_region_index_to',
            'single_data_master',
            'spot_instance',
            'spot_price',
            'teardown_cluster'
            ]:
        delattr(main_args, item)
    setattr(main_args, 'instance_type', 'm5.xlarge')
    instances_tag_data = get_instances_tag_data(main_args)
    if instances_tag_data is None:
        print('instances_tag_data is None')
        sys.exit(10)
    ec2_client = get_ec2_client(main_args, instances_tag_data)
    if ec2_client is None:
        sys.exit(20)
    run_args = get_run_args(
        main_args,
        instances_tag_data,
        is_database=True,
    )
    # Run Cases
    bdm = get_bdm(main_args)
    if 'db_user_data' not in run_args:
        print('No db_user_data in run_args')
        sys.exit(11)
    instances = ec2_client.create_instances(
        ImageId='ami-2133bc59',
        MinCount=1,
        MaxCount=1,
        InstanceType='c5.9xlarge',
        SecurityGroups=['ssh-http-https'],
        UserData=run_args['db_user_data'],
        BlockDeviceMappings=bdm,
        InstanceInitiatedShutdownBehavior='terminate',
        IamInstanceProfile={
            "Name": 'encoded-instance',
        }
    )
    _wait_and_tag_instances(
        main_args,
        run_args,
        instances_tag_data,
        instances,
        cluster_master=True,
        is_database=True,
    )

if __name__ == '__main__':
    main()
