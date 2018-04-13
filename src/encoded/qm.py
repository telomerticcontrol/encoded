import logging
from pyramid.view import view_config
from .search import search


def includeme(config):
    config.scan(__name__)
    config.add_route('qm', '/qm{slash:/?}')


LIMIT_ALL_JSON = '&limit=all&format=json'


HISTONE_PEAK_FILES_QUERY = (
    'type=File'
    '&output_type=replicated+peaks'
    '&output_type=stable+peaks'
    '&lab.title=ENCODE+Processing+Pipeline'
    '&file_format=bed'
    '&status=released'
    '&status=in+progress'
    '&status=uploading'
)


HISTONE_CHIP_EXPERIMENTS_QUERY = (
    'type=Experiment'
    '&assay_title=ChIP-seq'
    '&target.investigated_as=histone'
    '&award.project=ENCODE'
    '&status=released'
    '&status=in+progress'
    '&status=submitted'
)


EXPERIMENT_FIELDS_QUERY = (
    '&field=@id'
    '&field=accession'
    '&field=status'
    '&field=award.rfa'
    '&field=date_created'
    '&field=target.name'
    '&field=biosample_term_name'
    '&field=biosample_type'
    '&field=replication_type'
    '&field=lab.name'
)


FILE_FIELDS_QUERY = (
    '&field=@id'
    '&field=accession'
    '&field=date_created'
    '&field=status'
    '&field=dataset'
    '&field=assembly'
    '&field=step_run'
    '&field=quality_metrics'
    '&field=notes'
)


HISTONE_QC_FIELDS = [
    'nreads',
    'nreads_in_peaks',
    'npeak_overlap',
    'Fp',
    'Ft',
    'F1',
    'F2',
    'quality_metric_of'
]


def parse_json(json_object, fields):
    '''
    Returns object filtered by fields.
    '''
    return {
        field: json_object.get(field)
        for field in fields
    }


def logger_warn_skip(expected_type, experiment_id, len_data):
    logging.warn(
        'Expected one unique %s in experiment %s. '
        'Found %d. Skipping!' % (expected_type, experiment_id, len_data)
    )


def get_experiments_and_files(context, request, formatting, assembly):
    '''
    Returns all relevant experiment and files.
    '''
    ending = (
        '&assembly={}&format={}&limit=all'.format(assembly, formatting)
        if formatting
        else '&assembly={}&limit=all'.format(assembly)
    )
    experiment_query = HISTONE_CHIP_EXPERIMENTS_QUERY + EXPERIMENT_FIELDS_QUERY + ending
    request.query_string = experiment_query
    logging.warn(request.params)
    experiment_data = search(context, request).json['@graph']
    file_query = HISTONE_PEAK_FILES_QUERY + FILE_FIELDS_QUERY + ending
    request.query_string = file_query
    file_data = search(context, request).json['@graph']
    return experiment_data, file_data


def filter_related_files(experiment_id, file_data):
    return [f for f in file_data if f.get('dataset') == experiment_id]


def get_job_id_from_file(f):
    job_id = f.get('step_run').get('dx_applet_details', [])
    job_id = job_id[0].get('dx_job_id') if job_id else []
    if job_id:
        job_id = job_id.split(':')[1]
    return job_id


#def get_dx_details_from_job_id(job_id):
    #d = dxpy.describe(job_id)
    #return {
    #    'job_id': job_id,
    #    'analysis': d.get('analysis'),
    #    'project': d.get('project'),
    #    'output': d.get('output')
    #}


def frip_in_output(output):
    return any(['frip' in k for k in output])


def parse_experiment_file_qc(e, f, q):
    job_id = get_job_id_from_file(f)
    #dx_details = get_dx_details_from_job_id(job_id)
    #output = dx_details.pop('output', None)
    #has_frip = frip_in_output(output)
    qc_parsed = parse_json(q, HISTONE_QC_FIELDS)
    row = {
        'date': f.get('date_created'),
        'experiment_accession': e.get('accession'),
        'experiment_status': e.get('status'),
        'target': e.get('target', {}).get('name'),
        'biosample_term_name': e.get('biosample_term_name'),
        'biosample_type': e.get('biosample_type'),
        'replication': e.get('replication_type'),
        'lab': e.get('lab', {}).get('name'),
        'rfa': e.get('award', {}).get('rfa'),
        'assembly': f.get('assembly'),
        'job_id': job_id
    }
    row.update(qc_parsed)
    #row.update(dx_details)
    return row


def build_rows(experiment_data, file_data):
    '''
    Builds records that can be passed to a dataframe.
    For every experiment:
        1. Find every related file in file_data.
        2. Assert one file in group.
        3. Assert not more than one QC metric.
        4. Parse dx_job_id from file, get analysis_id.
        5. Parse QC metric (or return Nones)
        6. Append record to list.
    '''
    data = []
    for e in experiment_data:
        f = filter_related_files(e['@id'], file_data)
        if len(f) != 1:
            logger_warn_skip('related file', e['@id'], len(f))
            continue
        f = f[0]
        q = f.get('quality_metrics')
        if len(q) > 1:
            logger_warn_skip('quality metric', e['@id'], len(q))
            continue
        q = q[0] if q else {}
        data.append(parse_experiment_file_qc(e, f, q))
    return data


@view_config(route_name='qm', request_method='GET', permission='search')
def quality_metric(context, request):
    logging.warn('In qm')
    formatting = request.params.get('format')
    assembly = request.params.get('assembly', 'GRCh38')
    experiment_data, file_data = get_experiments_and_files(context, request, formatting, assembly)
    rows = build_rows(experiment_data, file_data)
    return {
        'exp': experiment_data,
        'file': file_data,
        'rows': rows,
        'title': 'Histone quality metric report',
        '@type': ['HistoneQCReport']
    }

