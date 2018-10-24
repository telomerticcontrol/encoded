from snovault import (
    calculated_property,
    collection,
    load_schema,
)
from .base import (
    SharedItem,
)
from pyramid.traversal import (
    find_root,
)
from snovault.validation import ValidationFailure


@collection(
    name='targets',
    unique_key='target:name',
    properties={
        'title': 'Targets',
        'description': 'Listing of ENCODE3 targets',
    })
class Target(SharedItem):
    item_type = 'target'
    schema = load_schema('encoded:schemas/target.json')
    embedded = ['organism', 'genes']

    def unique_keys(self, properties):
        keys = super(Target, self).unique_keys(properties)
        keys.setdefault('target:name', []).append(self._name(properties))
        return keys

    @calculated_property(schema={
        "title": "Organism",
        "description": "Organism bearing the target.",
        "comment": "Calculated from either target_organism or genes",
        "type": "string",
        "linkTo": "Organism"
    })
    def organism(self, request, genes, target_organism=None):
        if target_organism:
            return target_organism
        organisms = {
            request.embed(gene)
            for gene in genes
        }
        if len(organisms) != 1:
            msg = 'Target genes are from different organisms: {}'.format(
                organisms
            )
            raise ValidationFailure('body', ['genes'], msg)
        return next(iter(organisms))

    @calculated_property(schema={
        "title": "Name",
        "type": "string",
    })
    def name(self):
        return self.__name__

    @calculated_property(schema={
        "title": "Title",
        "type": "string",
    })
    def title(self, request, label, organism):
        organism_props = request.embed(organism, '@@object')
        return '{} ({})'.format(label, organism_props['scientific_name'])

    @property
    def __name__(self, request):
        properties = self.upgrade_properties()
        organism = request.embed(properties['organism'])
        return '{}-{}'.format(properties['label'], organism['name'])

    def __resource_url__(self, request, info):
        request._linked_uuids.add(str(self.uuid))
        # Record organism uuid in linked_uuids so linking objects record
        # the rename dependency.
        properties = self.upgrade_properties()
        organism = request.embed(properties['organism'])
        request._linked_uuids.add(organism['uuid'])
        return None
