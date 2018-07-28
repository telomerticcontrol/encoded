"""
Search View
"""
# pylint: disable=import-error, no-name-in-module
from collections import OrderedDict

from urllib.parse import urlencode

from pyramid.httpexceptions import HTTPBadRequest
from pyramid.security import effective_principals

from elasticsearch.helpers import scan

# pylint: disable=import-error
from snovault import (
    TYPES,
)
from snovault.elasticsearch.create_mapping import TEXT_FIELDS
from snovault.elasticsearch import ELASTIC_SEARCH

from encoded.vis_defines import vis_format_url


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
)

from .query_helpers import (
    get_filtered_query,
)

from . import (
    ES_QUERY_EXTEND,
)


# Query


def prepare_search_term(request):
    '''
    Prepare search term with lucene query
    '''
    from antlr4 import IllegalStateException
    from lucenequery.prefixfields import prefixfields
    from lucenequery import dialects

    search_term = request.params.get('searchTerm', '').strip() or '*'
    if search_term == '*':
        return search_term

    # avoid interpreting slashes as regular expressions
    search_term = search_term.replace('/', r'\/')
    # elasticsearch uses : as field delimiter, but we use it as namespace designator
    # if you need to search fields you have to use @type:field
    # if you need to search fields where the field contains ":", you will have to escape it
    # yourself
    if search_term.find("@type") < 0:
        # pylint: disable=anomalous-backslash-in-string
        search_term = search_term.replace(':', '\:')
    try:
        query = prefixfields('embedded.', search_term, dialects.elasticsearch)
    except IllegalStateException:
        msg = "Invalid query: {}".format(search_term)
        raise HTTPBadRequest(explanation=msg)
    else:
        return query.getText()


def set_sort_order(request, search_term, doc_types, query, result):
    '''Sets sort order for elasticsearch results'''
    types = request.registry[TYPES]
    sort = OrderedDict()
    result_sort = OrderedDict()
    requested_sort = request.params.get('sort')
    if requested_sort:
        if requested_sort.startswith('-'):
            name = requested_sort[1:]
            order = 'desc'
        else:
            name = requested_sort
            order = 'asc'
        if name not in TEXT_FIELDS:
            sort['embedded.' + name] = result_sort[name] = {
                'order': order,
                'unmapped_type': 'keyword',
            }
    if not sort and search_term == '*':
        if len(doc_types) == 1:
            type_schema = types[doc_types[0]].schema
            if 'sort_by' in type_schema:
                for key, val in type_schema['sort_by'].items():
                    sort['embedded.' + key] = result_sort[key] = dict(val)
        if not sort:
            sort['embedded.date_created'] = result_sort['date_created'] = {
                'order': 'desc',
                'unmapped_type': 'keyword',
            }
            sort['embedded.label'] = result_sort['label'] = {
                'order': 'asc',
                'missing': '_last',
                'unmapped_type': 'keyword',
            }
    if sort:
        query['sort'] = sort
        result['sort'] = result_sort
        return True
    return False


def set_filters(request, query, result, static_items=None):
    # pylint: disable=too-many-locals
    '''Sets filters in the query'''
    query_filters = query['post_filter']['bool']
    used_filters = {}
    if static_items is None:
        static_items = []
    qs_items = list(request.params.items())
    total_items = qs_items + static_items
    qs_fields = [item[0] for item in qs_items]
    fields = [item[0] for item in total_items]
    all_terms = {}
    for item in total_items:
        if item[0] in all_terms:
            all_terms[item[0]].append(item[1])
        else:
            all_terms[item[0]] = [item[1]]
    for field in fields:
        if field in used_filters:
            continue
        terms = all_terms[field]
        if field in ['type', 'limit', 'y.limit', 'x.limit', 'mode', 'annotation',
                     'format', 'frame', 'datastore', 'field', 'region', 'genome',
                     'sort', 'from', 'referrer']:
            continue
        if field in qs_fields:
            for term in terms:
                query_str = urlencode([
                    (key.encode('utf-8'), val.encode('utf-8'))
                    for key, val in qs_items
                    if '{}={}'.format(key, val) != '{}={}'.format(field, term)
                ])
                result['filters'].append({
                    'field': field,
                    'term': term,
                    'remove': '{}?{}'.format(request.path, query_str)
                })
        if field == 'searchTerm':
            continue
        used_filters[field] = terms
        build_terms_filter(query_filters, field, terms)
    return used_filters


def build_terms_filter(query_filters, field, terms):
    '''Build terms filter'''
    if field.endswith('!'):
        field = field[:-1]
        if not field.startswith('audit'):
            field = 'embedded.' + field
        if terms == ['*']:
            negative_filter_condition = {
                'exists': {
                    'field': field,
                }
            }
        else:
            negative_filter_condition = {
                'terms': {
                    field: terms
                }
            }
        query_filters['must_not'].append(negative_filter_condition)
    else:
        if not field.startswith('audit'):
            field = 'embedded.' + field
        if terms == ['*']:
            filter_condition = {
                'exists': {
                    'field': field,
                }
            }
        else:
            filter_condition = {
                'terms': {
                    field: terms,
                },
            }
        query_filters['must'].append(filter_condition)


def set_facets(facets, used_filters, principals, doc_types):
    """
    Sets facets in the query using filters
    """
    aggs = {}
    for facet_name, facet_options in facets:
        # Filter facet results to only include
        # objects of the specified type(s) that the user can see
        filters = [
            {'terms': {'principals_allowed.view': principals}},
            {'terms': {'embedded.@type': doc_types}},
        ]
        negative_filters = []
        # Also apply any filters NOT from the same field as the facet
        for field, terms in used_filters.items():
            if field.endswith('!'):
                query_field = field[:-1]
            else:
                query_field = field

            # if an option was selected in this facet,
            # don't filter the facet to only include that option
            if query_field == facet_name:
                continue

            if not query_field.startswith('audit'):
                query_field = 'embedded.' + query_field

            if field.endswith('!'):
                if terms == ['*']:
                    negative_filters.append({'exists': {'field': query_field}})
                else:
                    negative_filters.append({'terms': {query_field: terms}})
            else:
                if terms == ['*']:
                    filters.append({'exists': {'field': query_field}})
                else:
                    filters.append({'terms': {query_field: terms}})

        agg_name, agg = build_aggregation(facet_name, facet_options)
        aggs[agg_name] = {
            'aggs': {
                agg_name: agg
            },
            'filter': {
                'bool': {
                    'must': filters,
                    'must_not': negative_filters
                },
            },
        }

    return aggs


def build_aggregation(facet_name, facet_options, min_doc_count=0):
    """Specify an elasticsearch aggregation from schema facet configuration.
    """
    exclude = []
    if facet_name == 'type':
        field = 'embedded.@type'
        exclude = ['Item']
    elif facet_name.startswith('audit'):
        field = facet_name
    else:
        field = 'embedded.' + facet_name
    agg_name = facet_name.replace('.', '-')

    facet_type = facet_options.get('type', 'terms')
    if facet_type == 'terms':
        agg = {
            'terms': {
                'field': field,
                'min_doc_count': min_doc_count,
                'size': 200,
            },
        }
        if exclude:
            agg['terms']['exclude'] = exclude
    elif facet_type == 'exists':
        agg = {
            'filters': {
                'filters': {
                    'yes': {
                        'bool': {
                            'must': {
                                'exists': {'field': field}
                            }
                        }
                    },
                    'no': {
                        'bool': {
                            'must_not': {
                                'exists': {'field': field}
                            }
                        }
                    },
                },
            },
        }
    else:
        raise ValueError('Unrecognized facet type {} for {} facet'.format(
            facet_type, field))

    return agg_name, agg


def sort_query(unsorted_query):
    '''Query Helper to sort query'''
    sorted_query = OrderedDict()
    for field, value in sorted(unsorted_query.items()):
        if isinstance(value, dict):
            sorted_query[field] = sort_query(value)
        else:
            sorted_query[field] = value
    return sorted_query


# ES
def get_pagination(request):
    from_ = request.params.get('from') or 0
    size = request.params.get('limit', 25)
    if size in ('all', ''):
        size = None
    else:
        try:
            size = int(size)
        except ValueError:
            size = 25
    return from_, size


def format_facets(es_results, facets, used_filters, schemas, total, principals):
    result = []
    # Loading facets in to the results
    if 'aggregations' not in es_results:
        return result

    aggregations = es_results['aggregations']
    used_facets = set()
    exists_facets = set()
    for field, options in facets:
        used_facets.add(field)
        agg_name = field.replace('.', '-')
        if agg_name not in aggregations:
            continue
        all_buckets_total = aggregations[agg_name]['doc_count']
        if not all_buckets_total > 0:
            continue
        # internal_status exception. Only display for admin users
        if field == 'internal_status' and 'group.admin' not in principals:
            continue
        facet_type = options.get('type', 'terms')
        terms = aggregations[agg_name][agg_name]['buckets']
        if facet_type == 'exists':
            terms = [
                {'key': 'yes', 'doc_count': terms['yes']['doc_count']},
                {'key': 'no', 'doc_count': terms['no']['doc_count']},
            ]
            exists_facets.add(field)
        result.append({
            'type': facet_type,
            'field': field,
            'title': options.get('title', field),
            'terms': terms,
            'total': all_buckets_total
        })

    # Show any filters that aren't facets as a fake facet with one entry,
    # so that the filter can be viewed and removed
    for field, values in used_filters.items():
        if field not in used_facets and field.rstrip('!') not in exists_facets:
            title = field
            for schema in schemas:
                if field in schema['properties']:
                    title = schema['properties'][field].get('title', field)
                    break
            result.append({
                'field': field,
                'title': title,
                'terms': [{'key': v} for v in values],
                'total': total,
            })

    return result


def search_result_actions(request, doc_types, es_results, position=None):
    '''Helper for parse es results'''
    actions = {}
    aggregations = es_results['aggregations']

    # generate batch hub URL for experiments
    # TODO we could enable them for Datasets as well here, but not sure how well it will work
    if doc_types == ['Experiment'] or doc_types == ['Annotation']:
        viz = {}
        for bucket in aggregations['assembly']['assembly']['buckets']:
            if bucket['doc_count'] > 0:
                assembly = bucket['key']
                if assembly in viz:  # mm10 and mm10-minimal resolve to the same thing
                    continue
                search_params = request.query_string.replace('&', ',,')
                if not request.params.getall('assembly') \
                or assembly in request.params.getall('assembly'):
                    # filter  assemblies that are not selected
                    hub_url = request.route_url('batch_hub', search_params=search_params,
                                                txt='hub.txt')
                    browser_urls = {}
                    pos = None
                    if 'region-search' in request.url and position is not None:
                        pos = position
                    ucsc_url = vis_format_url("ucsc", hub_url, assembly, pos)
                    if ucsc_url is not None:
                        browser_urls['UCSC'] = ucsc_url
                    ensembl_url = vis_format_url("ensembl", hub_url, assembly, pos)
                    if ensembl_url is not None:
                        browser_urls['Ensembl'] = ensembl_url
                    if browser_urls:
                        viz[assembly] = browser_urls
                        #actions.setdefault('visualize_batch', {})[assembly] = browser_urls  # formerly 'batch_hub'
        if viz:
            actions.setdefault('visualize_batch',viz)

    # generate batch download URL for experiments
    # TODO we could enable them for Datasets as well here, but not sure how well it will work
    # batch download disabled for region-search results
    if '/region-search/' not in request.url:
        #if (doc_types == ['Experiment'] or doc_types == ['Annotation']) and any(
        if (doc_types == ['Experiment']) and any(
                bucket['doc_count'] > 0
                for bucket in aggregations['files-file_type']['files-file_type']['buckets']):
            actions['batch_download'] = request.route_url(
                'batch_download',
                search_params=request.query_string
            )

    return actions


def format_results(request, hits, result=None):
    """Loads results to pass onto UI"""
    fields_requested = request.params.getall('field')
    if fields_requested:
        frame = 'embedded'
    else:
        frame = request.params.get('frame')

    # Request originating from metadata generation will skip to
    # partion of the code that adds audit  object to result items
    if request.__parent__ and '/metadata/' in request.__parent__.url:
        frame = ''

    any_released = False  # While formatting, figure out if any are released.

    if frame in ['embedded', 'object']:
        for hit in hits:
            if not any_released and hit['_source'][frame].get('status', 'released') == 'released':
                any_released = True
            yield hit['_source'][frame]
    else:
        # columns
        for hit in hits:
            item = hit['_source']['embedded']
            if not any_released and item.get('status','released') == 'released':
                any_released = True # Not exp? 'released' to do the least harm
            if 'audit' in hit['_source']:
                item['audit'] = hit['_source']['audit']
            if 'highlight' in hit:
                item['highlight'] = {}
                for key in hit['highlight']:
                    item['highlight'][key[9:]] = list(set(hit['highlight'][key]))
            yield item

    # After all are yielded, it may not be too late to change this result setting
    #if not any_released and result is not None and 'batch_hub' in result:
    #    del result['batch_hub']
    if not any_released and result is not None and 'visualize_batch' in result:
        del result['visualize_batch']


def iter_long_json(name, iterable, other):
    import json

    start = None

    # Note: by yielding @graph (iterable) first, then the contents of result (other) *may* be altered based upon @graph
    it = iter(iterable)
    try:
        first = next(it)
    except StopIteration:
        pass
    else:
        #yield json.dumps(first)
        start = '{' + json.dumps(name) + ':['
        yield start + json.dumps(first)
        for value in it:
            yield ',' + json.dumps(value)

    if start is None: # Nothing has bee yielded yet
        yield json.dumps(other)
    else:
        other_stuff = (',' + json.dumps(other)[1:-1]) if other else ''
        yield ']' + other_stuff + '}'


class SearchView(object):
    '''
    Standard Search View Endpoint
    '''
    def __init__(
            self,
            request,
            search_type=None,
        ):
        # pylint: disable=too-many-locals
        request_path = request.path
        request_params_mode = request.params.get('mode')
        request_params_search_terms = request.params.getall('searchTerm')
        request_search_term = prepare_search_term(request)
        request_principals = effective_principals(request)
        request_registry_types = request.registry[TYPES]
        request_search_audit_permission = request.has_permission('search_audit')
        request_search_base = normalize_query(request)
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
        query_result_fields = list_result_fields(request, doc_types)
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
            self.request,
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


