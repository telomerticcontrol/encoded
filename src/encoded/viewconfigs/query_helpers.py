"""
Helpers functions used to build es query in view configs
"""
from collections import OrderedDict
from urllib.parse import urlencode  # pylint: disable=import-error, no-name-in-module

from snovault.elasticsearch.create_mapping import TEXT_FIELDS # pylint: disable=import-error


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


def get_filtered_query(term, search_fields, result_fields, principals, doc_types):
    '''Filter Query Object Template'''
    return {
        'query': {
            'query_string': {
                'query': term,
                'fields': search_fields,
                'default_operator': 'AND'
            }
        },
        'post_filter': {
            'bool': {
                'must': [
                    {
                        'terms': {
                            'principals_allowed.view': principals
                        }
                    },
                    {
                        'terms': {
                            'embedded.@type': doc_types
                        }
                    }
                ],
                'must_not': []
            }
        },
        '_source': list(result_fields),
    }


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


def set_sort_order(
        request_registry_types,
        request_params_sort,
        search_term,
        doc_types,
        query,
        result
    ):
    # pylint: disable=too-many-arguments
    '''Sets sort order for elasticsearch results'''
    sort = OrderedDict()
    result_sort = OrderedDict()
    if request_params_sort:
        if request_params_sort.startswith('-'):
            name = request_params_sort[1:]
            order = 'desc'
        else:
            name = request_params_sort
            order = 'asc'
        if name not in TEXT_FIELDS:
            sort['embedded.' + name] = result_sort[name] = {
                'order': order,
                'unmapped_type': 'keyword',
            }
    if not sort and search_term == '*':
        if len(doc_types) == 1:
            type_schema = request_registry_types[doc_types[0]].schema
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


def sort_query(unsorted_query):
    '''Query Helper to sort query'''
    sorted_query = OrderedDict()
    for field, value in sorted(unsorted_query.items()):
        if isinstance(value, dict):
            sorted_query[field] = sort_query(value)
        else:
            sorted_query[field] = value
    return sorted_query
