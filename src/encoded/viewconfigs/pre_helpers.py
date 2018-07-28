"""
Helpers function used to initialize view configs
"""
from collections import OrderedDict
from urllib.parse import urlencode  # pylint: disable=import-error, no-name-in-module

from . import (
    AUDIT_FACETS,
    DEFAULT_DOC_TYPES,
)


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
    '''
    Return desired default doc types
    '''
    if request_mode == 'picker':
        return ['Item']
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


def get_facets(
        request_registry_types,
        doc_types,
        request_search_audit_permission,
        request_principals,
    ):
    '''
    Create facets for searchj
    '''
    facets = [('type', {'title': 'Data Type'})]
    if (len(doc_types) == 1 and
            'facets' in request_registry_types[doc_types[0]].schema):
        facets.extend(request_registry_types[doc_types[0]].schema['facets'].items())
    for audit_facet in AUDIT_FACETS:
        if (request_search_audit_permission and
                'group.submitter' in request_principals or
                'INTERNAL_ACTION' not in audit_facet[0]):
            facets.append(audit_facet)
    return facets


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


def get_search_fields(request_registry_types, doc_types):
    """
    Returns set of columns that are being searched and highlights
    """

    fields = {'uuid', 'unique_keys.*'}
    highlights = {}
    for doc_type in doc_types:
        type_info = request_registry_types[doc_type]
        for value in type_info.schema.get('boost_values', ()):
            fields.add('embedded.' + value)
            highlights['embedded.' + value] = {}
    return list(fields), highlights


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


def list_result_fields(request, doc_types):
    """
    Returns set of fields that are requested by user or default fields
    """
    frame = request.params.get('frame')
    fields_requested = request.params.getall('field')
    if fields_requested:
        fields = {'embedded.@id', 'embedded.@type'}
        fields.update('embedded.' + field for field in fields_requested)
    elif frame in ['embedded', 'object']:
        fields = [frame + '.*']
    else:
        frame = 'columns'
        # Fields that front-end expects is not returned as an empty array.
        # At this time, no way of knowing knowing which are those fields
        # that are not covered by tests, hence embedded.* for _source
        fields = {'embedded.@id', 'embedded.@type'}
        if request.has_permission('search_audit'):
            fields.add('audit.*')
        types = request.registry[TYPES]
        schemas = [types[doc_type].schema for doc_type in doc_types]
        columns = list_visible_cols_for_schemas(request, schemas)
        fields.update('embedded.' + column for column in columns)

    # Ensure that 'audit' field is requested with _source in the ES query
    if (request.__parent__ and
            '/metadata/' in request.__parent__.url and
            request.has_permission('search_audit')):
        fields.add('audit.*')
    return fields


def list_visible_cols_for_schemas(request, schemas):
    """
    Returns mapping of default columns for a set of schemas.
    """
    columns = OrderedDict({'@id': {'title': 'ID'}})
    for schema in schemas:
        if 'columns' in schema:
            columns.update(schema['columns'])
        else:
            # default columns if not explicitly specified
            columns.update(OrderedDict(
                (name, {
                    'title': schema['properties'][name].get('title', name)
                })
                for name in [
                    '@id', 'title', 'description', 'name', 'accession',
                    'aliases'
                ] if name in schema['properties']
            ))

    fields_requested = request.params.getall('field')
    if fields_requested:
        limited_columns = OrderedDict()
        for field in fields_requested:
            if field in columns:
                limited_columns[field] = columns[field]
            else:
                # We don't currently traverse to other schemas for embedded
                # objects to find property titles. In this case we'll just
                # show the field's dotted path for now.
                limited_columns[field] = {'title': field}
                for schema in schemas:
                    if field in schema['properties']:
                        limited_columns[field] = {
                            'title': schema['properties'][field]['title']
                        }
                        break
        columns = limited_columns
    return columns


def normalize_query(request_registry_types, request_items_gen):
    '''
    Clearn up query
    '''
    fixed_types = (
        (k, request_registry_types[v].name if k == 'type' and v in request_registry_types else v)
        for k, v in request_items_gen
    )
    query_str = urlencode([
        (k.encode('utf-8'), v.encode('utf-8'))
        for k, v in fixed_types
    ])
    return '?' + query_str if query_str else ''
