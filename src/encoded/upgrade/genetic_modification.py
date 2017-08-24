from snovault import (
    CONNECTION,
    upgrade_step
)


@upgrade_step('genetic_modification', '1', '2')
def genetic_modification_1_2(value, system):
    # http://redmine.encodedcc.org/issues/3063
    if 'modifiction_description' in value:
        value['modification_description'] = value['modifiction_description']
        value.pop('modifiction_description')


@upgrade_step('genetic_modification', '2', '3')
def genetic_modification_2_3(value, system):
    # http://redmine.encodedcc.org/issues/4448
    if 'modification_description' in value:
        value['description'] = value['modification_description']
        value.pop('modification_description')

    if 'modification_zygocity' in value:
        value['zygosity'] = value['modification_zygocity']
        value.pop('modification_zygocity')

    if 'modification_purpose' in value:
        value['purpose'] = value['modification_purpose']
        value.pop('modification_purpose')

    if 'modification_genome_coordinates' in value:
        value['modified_site'] = value['modification_genome_coordinates']
        value.pop('modification_genome_coordinates')

    if 'modification_treatments' in value:
        value['treatments'] = value['modification_treatments']
        value.pop('modification_treatments')


@upgrade_step('genetic_modification', '5', '6')
def genetic_modification_5_6(value, system):
    # https://encodedcc.atlassian.net/browse/ENCD-3088
    if 'target' in value:
        value['modified_site_by_target_id'] = value['target']
        value.pop('target')

    if 'modified_site' in value:
        value['modified_site_by_coordinates'] = value['modified_site']
        value.pop('modified_site')

    rep_obj = dict()
    has_source = False
    if 'source' in value:
        # If for some inexplicable reason, there is a source associated with the genetic_modification,
        # let's move it to reagent repository for now. If there is one in the technique, we'll overwrite it
        # and use that one instead.
        rep_obj.update({'repository': value['source']})
        has_source = True
        value.pop('source')

    if 'product_id' in value:
        # If for some inexplicable reason, there is a product_id associated with the genetic_modification,
        # let's move it to reagent identifiers for now. If there is one in the technique, we'll overwrite it
        # and use those instead.
        rep_obj.update({'identifier': value['product_id']})
        value.pop('product_id')
    else:
        # If we have a source but no product id, it's likely from a lab. Backfill with this default.
        if has_source:
            rep_obj.update({'identifier': 'please-contact-lab'})

    if rep_obj:
        if 'reagent_availability' not in value:
            value['reagent_availability'] = [rep_obj]
        else:
            value['reagent_availability'].append(rep_obj)
        has_source = False

    # New required properties modification_technique and purpose need to be handled somehow
    if value['modification_techniques']:
        alias_flag = False
        for t in value['modification_techniques']:
            technique = t
            if 'aliases' in technique:
                alias_flag = True
            rep_obj = dict()
            if 'source' in technique:
                rep_obj.update({'repository': technique.get('source')})
                has_source = True
            if 'product_id' in technique:
                rep_obj.update({'identifier': technique.get('product_id')})
            else:
                # If we have a source but no product id, it's likely from a lab. Backfill with this default.
                if has_source:
                    rep_obj.update({'identifier': 'please-contact-lab'})

            if rep_obj:
                if 'reagent_availability' not in value:
                    value['reagent_availability'] = [rep_obj]
                else:
                    value['reagent_availability'].append(rep_obj)
                has_source = False
            if 'guide_rna_sequences' in technique:
                value['guide_rna_sequences'] = technique.get('guide_rna_sequences')
                value['modification_technique'] = 'CRISPR'

                if 'insert_sequence' in technique:
                    value['introduced_sequence'] = technique.get('insert_sequence')
                if alias_flag:
                    for a in technique.get('aliases'):
                        b = a + '-CRISPR'
                        if 'aliases' in value:
                            value['aliases'].append(b)
                        else:
                            value['aliases'] = [b]
                if 'purpose' in value and value['purpose'] == 'tagging':
                    # Those modification objects that are CRISPR tag insertions can't be upgraded
                    # this way since the dependencies require them to have tag info and that 
                    # metadata sits in construct so they must be migrated manually with all 
                    # constructs. The only ones in this class right now are the Snyder CRISPR-tag
                    # lines and those all have C-terminal eGFP tags.
                    value['epitope_tags'] = [{'name': 'eGFP', 'location': 'C-terminal'}]
                
            elif 'talen_platform' in technique:
                value['modification_technique'] = 'TALE'
                # We think these should have purpose = repression if empty. The Stam lab isn't
                # doing any other types of TALE modifications right now. For the purposes
                # of the upgrade, let's add that in for now.
                if 'purpose' not in value:
                    value['purpose'] = 'repression'
                if 'notes' in value:
                    value['notes'] = value['notes'] + '. TALEN platform: ' + technique.get('talen_platform')
                else:
                    value['notes'] = 'TALEN platform ' + technique.get('talen_platform')
                if alias_flag:
                    for a in technique.get('aliases'):
                        b = a + '-TALE'
                        if 'aliases' in value:
                            value['aliases'].append(b)
                        else:
                            value['aliases'] = [b]
            else:
                # This shouldn't happen as we currently don't have any other possible techniques
                # so let's just set it to something we know we don't have yet annotated correctly
                # in the data so we can identify special cases to deal with
                value['modification_technique'] = 'microinjection'
    else:
        value['modification_technique'] = 'microinjection'

    if 'modification_techniques' in value:
        # These will no longer be linked out to the respective technique objects. The
        # migration will have to happen with a manual patch to move those properties
        # into new ones in genetic_modification.json
        value.pop('modification_techniques')

    if 'purpose' not in value:
        # This shouldn't happen as we currently don't have any GM objects missing purpose,
        # so let's just set it to something we know we don't have yet annotated in the data so
        # we can identify any special cases we might need to deal with
        value['purpose'] = 'analysis'
