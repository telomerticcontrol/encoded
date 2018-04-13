import React from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../libs/bootstrap/modal';
import { Panel, PanelHeading, PanelBody } from '../libs/bootstrap/panel';
import { collapseIcon } from '../libs/svg-icons';
import { AttachmentPanel } from './doc';
import { FetchedData, Param } from './fetched';
import * as globals from './globals';


class QMReport extends React.Component {
    constructor() {
        super();
    }

    componentWillMount() {
        this.setState({'data': this.props.context.rows});
    }

    render() {
        console.log('props');
        console.log(this.props.context.rows);
        return (<div>
                <table>
                    <tbody>
                        <th>experiment_accession</th>
                        <th>experiment_status</th>
                        <th>date</th>
                        <th>target</th>
                        <th>biosample_term_name</th>
                        <th>biosample_type</th>
                        <th>replication</th>
                        <th>lab</th>
                        <th>rfa</th>
                        <th>assembly</th>
                        <th>job_id</th>
                        <th>nreads</th>
                        <th>nreads_in_peaks</th>
                        <th>npeak_overlap</th>
                        <th>Fp</th>
                        <th>Ft</th>
                        <th>F1</th>
                        <th>F2</th>
                        <th>quality_metric_of</th>
                         {this.state.data.map((row, idx) => {
                              return (
                                   <tr key={idx}>
                                      <td>{row.experiment_accession}</td>
                                      <td>{row.experiment_status}</td>
                                      <td>{row.date}</td>
                                      <td>{row.target}</td>
                                      <td>{row.biosample_term_name}</td>
                                      <td>{row.biosample_type}</td>
                                      <td>{row.replication}</td>
                                      <td>{row.lab}</td>
                                      <td>{row.rfa}</td>
                                      <td>{row.assembly}</td>
                                      <td>{row.job_id}</td>
                                      <td>{row.nreads}</td>
                                      <td>{row.nreads_in_peaks}</td>
                                      <td>{row.npeak_overlap}</td>
                                      <td>{row.Fp}</td>
                                      <td>{row.Ft}</td>
                                      <td>{row.F1}</td>
                                      <td>{row.F2}</td>
                                      <td>{row.quality_metric_of}</td>
                                    </tr>
                               )
                          })}
                     </tbody>
                </table>
                </div>
        );
    }
}

globals.contentViews.register(QMReport, 'QMReport');

