import argparse
import datetime
import getpass
import re
import subprocess
import sys
import time

from base64 import b64encode
from os.path import expanduser

import boto3

from .deploy import (
    parse_args,
    nameify,
    tag_ec2_instance,
    read_ssh_key,
    _get_bdm,
    get_user_data,
    _get_instances_tag_data,
    _get_ec2_client,
    _wait_and_tag_instances,
)


def _get_run_args(main_args, instances_tag_data):
    master_user_data = None
    if not main_args.elasticsearch == 'yes':
        security_groups = ['ssh-http-https']
        iam_role = 'encoded-instance'
        count = 1
        data_insert = {
            'WALE_S3_PREFIX': main_args.wale_s3_prefix,
            'COMMIT': instances_tag_data['commit'],
            'ROLE': main_args.role,
            'REGION_INDEX': 'False',
            'ES_IP': main_args.es_ip,
            'ES_PORT': main_args.es_port,
        }
        if main_args.no_es:
            config_file = ':cloud-config-no-es.yml'
        elif main_args.cluster_name:
            config_file = ':cloud-config-cluster.yml'
            data_insert['CLUSTER_NAME'] = main_args.cluster_name
            data_insert['REGION_INDEX'] = 'True'
        else:
            config_file = ':cloud-config.yml'
        if main_args.set_region_index_to:
            data_insert['REGION_INDEX'] = main_args.set_region_index_to
        user_data = get_user_data(instances_tag_data['commit'], config_file, data_insert, main_args.profile_name)
    else:
        if not main_args.cluster_name:
            print("Cluster must have a name")
            sys.exit(1)
        count = int(main_args.cluster_size)
        security_groups = ['elasticsearch-https']
        iam_role = 'elasticsearch-instance'
        config_file = ':cloud-config-elasticsearch.yml'
        data_insert = {
            'CLUSTER_NAME': main_args.cluster_name,
            'ES_DATA': 'true',
            'ES_MASTER': 'true',
            'MIN_MASTER_NODES': int(count/2 + 1),
        }
        if main_args.db_data_master:
            data_insert['ES_MASTER'] = 'false'
            data_insert['MIN_MASTER_NODES'] = 1
        user_data = get_user_data(
            instances_tag_data['commit'],
            config_file,
            data_insert,
            main_args.profile_name
        )
    run_args = {
        'count': count,
        'iam_role': iam_role,
        'user_data': user_data,
        'security_groups': security_groups,
    }
    return run_args


def main():
    # Gather Info
    main_args = parse_args()
    instances_tag_data = _get_instances_tag_data(main_args)
    if instances_tag_data is None:
        sys.exit(10)
    ec2_client = _get_ec2_client(main_args, instances_tag_data)
    if ec2_client is None:
        sys.exit(20)
    run_args = _get_run_args(main_args, instances_tag_data)
    # Run Cases
    bdm = _get_bdm(main_args)
    if 'db_user_data' in run_args:
    # instances = ec2_client.create_instances(
    #     ImageId='ami-2133bc59',
    #     MinCount=1,
    #     MaxCount=1,
    #     InstanceType='c5.9xlarge',
    #     SecurityGroups=['ssh-http-https'],
    #     UserData=run_args['db_user_data'],
    #     BlockDeviceMappings=bdm,
    #     InstanceInitiatedShutdownBehavior='terminate',
    #     IamInstanceProfile={
    #         "Name": 'encoded-instance',
    #     }
    # )
    # _wait_and_tag_instances(main_args, run_args, instances_tag_data, instances, cluster_master=True)


if __name__ == '__main__':
    main()
