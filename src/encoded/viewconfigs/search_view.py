"""
Search View
"""
# pylint: disable=import-error, no-name-in-module
from urllib.parse import urlencode

from pyramid.httpexceptions import HTTPBadRequest
from pyramid.security import effective_principals

from elasticsearch.helpers import scan

# pylint: disable=import-error
from snovault import (
    TYPES,
)
from snovault.elasticsearch import ELASTIC_SEARCH

from .pre_helpers import (
    get_clear_filters,
    get_default_doc_types,
    get_doc_types_filters,
    get_facets,
    get_pre_doc_types,
    get_views_for_single_doc_type,
    get_search_fields,
    list_result_fields,
    list_visible_cols_for_schemas,
    normalize_query,
    prepare_search_term,
)
from .query_helpers import (
    get_filtered_query,
    set_facets,
    set_filters,
    set_sort_order,
    sort_query,
)
from .post_helpers import (
    get_pagination,
    format_facets,
    format_results,
    iter_long_json,
    search_result_actions,
)

from . import (
    ES_QUERY_EXTEND,
)


class SearchView(object):
    '''
    Standard Search View Endpoint
    '''
    # pylint: disable=too-many-instance-attributes
    def __init__(
            self,
            request,
            search_type=None,
        ):
        # pylint: disable=too-many-locals, too-many-statements
        request_path = request.path
        request_params_mode = request.params.get('mode')
        request_params_search_terms = request.params.getall('searchTerm')
        request_search_term = prepare_search_term(request)
        request_principals = effective_principals(request)
        request_registry_types = request.registry[TYPES]
        request_search_audit_permission = request.has_permission('search_audit')
        request_search_base = normalize_query(request_registry_types, request.params.items())
        request_search_route_path = request.route_path('search', slash='/')
        doc_types, bad_doc_types = get_pre_doc_types(
            request.registry[TYPES],
            request.params.getall('type'),
            search_type
        )
        if bad_doc_types:
            msg = "Invalid type: {}".format(', '.join(bad_doc_types))
            raise HTTPBadRequest(explanation=msg)
        clear_filters = get_clear_filters(
            request_params_search_terms,
            request_search_route_path,
            doc_types,
        )
        result_views = None
        if not doc_types:
            doc_types = get_default_doc_types(request_params_mode)
            result_filters = []
        else:
            result_filters = get_doc_types_filters(
                request_registry_types,
                request.params.items(),
                request_path,
                doc_types,
            )
            if len(doc_types) == 1:
                result_views = get_views_for_single_doc_type(
                    request,
                    request_search_base,
                    request.registry[TYPES][doc_types[0]].factory
                )
        schemas = [
            request_registry_types[doc_type].schema
            for doc_type in doc_types
        ]
        result_columns = list_visible_cols_for_schemas(request, schemas)
        search_fields, highlights = get_search_fields(request_registry_types, doc_types)
        facets = get_facets(
            request_registry_types,
            doc_types,
            request_search_audit_permission,
            request_principals,
        )
        query_result_fields = list_result_fields(request, doc_types, request_registry_types)
        self.doc_type_schemas = schemas
        self.doc_types = doc_types
        self.facets = facets
        self.highlights = highlights
        self.principals = request_principals
        self.query_result_fields = query_result_fields

        self.registry_types = request_registry_types
        self.request = request
        self.search_audit = request_search_audit_permission
        self.search_base = request_search_base
        self.search_fields = search_fields
        self.search_term = request_search_term
        self.search_result = {
            '@context': request.route_path('jsonld_context'),
            '@id': '/search/' + request_search_base,
            '@type': ['Search'],
            'clear_filters': clear_filters,
            'filters': result_filters,
            'title': 'Search',
        }
        if result_columns:
            self.search_result['columns'] = result_columns
        if result_views is not None:
            self.search_result['views'] = result_views
        # Set in functions
        self.used_filters = None
        self.query = None
        self.es_index = None
        self.from_ = None
        self.size = None
        self.do_scan = None
        self.es_results = None
        self.es_hits = None

    def update_result_with_es(self, context):
        '''Update search results after query es'''
        total = self.es_results['hits']['total']
        self.search_result['facets'] = format_facets(
            self.es_results,
            self.facets,
            self.used_filters,
            self.doc_type_schemas,
            total,
            self.principals,
        )
        self.search_result['total'] = total
        self.search_result.update(
            search_result_actions(
                self.request, self.doc_types, self.es_results
            )
        )
        if (self.size is not None and
                self.size < self.search_result['total']):
            params = [
                (key, val)
                for key, val in self.request.params.items()
                if key != 'limit'
            ]
            params.append(('limit', 'all'))
            self.search_result['all'] = '%s?%s' % (
                self.request.resource_path(context),
                urlencode(params)
            )

    def query_es(self):
        '''Use query to get es results'''
        request_params_type = self.request.params.get('type')
        if not request_params_type or 'Item' in self.doc_types:
            es_index = '_all'
        else:
            es_index = [
                self.registry_types[type_name].item_type
                for type_name in self.doc_types
                if hasattr(self.registry_types[type_name], 'item_type')
            ]
        elastic_search = self.request.registry[ELASTIC_SEARCH]
        from_, size = get_pagination(self.request)
        do_scan = size is None or size > 1000
        if do_scan:
            es_results = elastic_search.search(
                body=self.query,
                index=es_index,
                search_type='query_then_fetch'
            )
        else:
            es_results = elastic_search.search(
                body=self.query,
                index=es_index,
                from_=from_,
                size=size,
                request_cache=True
            )
        self.es_index = es_index
        self.from_ = from_
        self.size = size
        self.do_scan = do_scan
        self.es_results = es_results

    def query_es_scan_hits(self):
        '''Run scan on es query'''
        del self.query['aggs']
        elastic_search = self.request.registry[ELASTIC_SEARCH]
        if self.size is None:
            hits = scan(
                elastic_search,
                query=self.query,
                index=self.es_index,
                preserve_order=False
            )
        else:
            hits = scan(
                elastic_search,
                query=self.query,
                index=self.es_index,
                from_=self.from_,
                size=self.size,
                preserve_order=False
            )
        self.es_hits = hits

    def set_query(self):
        '''Build ES query from init'''
        query = get_filtered_query(
            self.search_term,
            self.search_fields,
            sorted(self.query_result_fields),
            self.principals,
            self.doc_types
        )
        if self.search_term == '*':
            del query['query']['query_string']
        else:
            query['query']['query_string']['fields'].extend(ES_QUERY_EXTEND)
        set_sort_order(
            self.registry_types,
            self.request.params.get('sort'),
            self.search_term,
            self.doc_types,
            query,
            self.search_result
        )
        # Try to find a better way to get used_filters to parse es results
        used_filters = set_filters(self.request, query, self.search_result)
        query['aggs'] = set_facets(
            self.facets,
            used_filters,
            self.principals,
            self.doc_types
        )
        self.used_filters = used_filters
        self.query = sort_query(query)

    def response_graph(self, return_generator):
        '''Return graph after es results found'''
        graph = format_results(self.request, self.es_hits, self.search_result)
        if return_generator:
            return graph
        self.search_result['@graph'] = list(graph)
        return self.search_result

    def response_graph_iter(self):
        '''Return iter graph after es results found'''
        graph = format_results(self.request, self.es_hits, self.search_result)
        app_iter = iter_long_json('@graph', graph, self.search_result)
        self.request.response.content_type = 'application/json'
        if str is bytes:  # Python 2 vs 3 wsgi differences
            self.request.response.app_iter = app_iter  # Python 2
        else:
            self.request.response.app_iter = (s.encode('utf-8') for s in app_iter)
        return self.request.response

    def response_no_results(self, return_generator):
        '''Return after no es results found'''
        self.request.response.status_code = 404
        self.search_result['notification'] = 'No results found'
        self.search_result['@graph'] = []
        return self.search_result if not return_generator else []

    def response_no_scan(self, return_generator):
        '''Return after es results if no do scan'''
        graph = format_results(
            self.request,
            self.es_results['hits']['hits'],
            self.search_result
        )
        if return_generator:
            return graph
        self.search_result['@graph'] = list(graph)
        return self.search_result
