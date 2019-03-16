from pyramid.view import view_config
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.security import (
    NO_PERMISSION_REQUIRED,
)

from collections import OrderedDict

from snovault import COLLECTIONS


def includeme(config):
    config.scan(__name__)
    config.add_route('swagger', '/swagger')


@view_config(
    route_name='swagger',
    request_method='GET',
    permission=NO_PERMISSION_REQUIRED)
def swagger(request):
    result = {
        '@id': '/swagger',
        '@type': ['swagger'],
        'title': 'Swagger',
    }
    return result
