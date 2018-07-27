from urllib.parse import urlencode


DEFAULT_DOC_TYPES = [
    'AntibodyLot',
    'Award',
    'Biosample',
    'Dataset',
    'GeneticModification',
    'Page',
    'Pipeline',
    'Publication',
    'Software',
    'Target',
]


def get_clear_filters(request_search_terms, request_route_path, doc_types):
    '''
    Create clear filters from pre build doc_types or searchTerm
    '''
    clear_filters_list = []
    clear_filters_str = ''
    if request_search_terms:
        clear_filters_list = [("searchTerm", item) for item in request_search_terms]
    elif doc_types:
        clear_filters_list = [("type", item) for item in doc_types]
    if clear_filters_list:
        clear_filters_str = '?' + urlencode(clear_filters_list)
    return request_route_path + clear_filters_str


def get_default_doc_types(request_mode):
    if request_mode == 'picker':
        return ['Item']
    else:
        return DEFAULT_DOC_TYPES


def get_doc_types_filters(registry_types, request_items_gen, request_path, doc_types):
    '''
    Create filters from pre build doc_types
    '''
    doc_types_filters = []
    for doc_type in doc_types:
        registry_doc_type = registry_types[doc_type]
        filter_list = [
            (k.encode('utf-8'), v.encode('utf-8'))
            for k, v in request_items_gen
            if not (k == 'type' and registry_types['Item' if v == '*' else v] is registry_doc_type)
        ]
        filter_str = urlencode(filter_list)
        doc_types_filters.append(
            {
                'field': 'type',
                'term': registry_doc_type.name,
                'remove': '{}?{}'.format(request_path, filter_str)
            }
        )
    return doc_types_filters


def get_pre_doc_types(registry_types, request_types, search_type):
    '''
    Pre build of doc_types for clear filters

    Also returns any bad doc types found
    '''
    doc_types = []
    bad_doc_types = []
    if search_type:
        check_doc_types = [search_type]
    elif '*' in request_types:
        check_doc_types = ['Item']
    else:
        check_doc_types = request_types
    for doc_type in check_doc_types:
        if doc_type in registry_types:
            doc_types.append(registry_types[doc_type].name)
        else:
            bad_doc_types.append(doc_type)
    return sorted(doc_types), bad_doc_types


def get_views_for_single_doc_type(request, search_base, registry_type_factory):
    '''
    Return a list of views when single doc type
    '''
    views = []
    views.append({
        'href': request.route_path('report', slash='/') + search_base,
        'title': 'View tabular report',
        'icon': 'table',
    })
    if hasattr(registry_type_factory, 'matrix'):
        views.append({
            'href': request.route_path('matrix', slash='/') + search_base,
            'title': 'View summary matrix',
            'icon': 'th',
        })
    if hasattr(registry_type_factory, 'summary_data'):
        views.append({
            'href': request.route_path('summary', slash='/') + search_base,
            'title': 'View summary report',
            'icon': 'summary',
        })
    return views
