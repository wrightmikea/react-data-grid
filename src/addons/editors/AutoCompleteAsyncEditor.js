/**
* @jsx React.DOM
*/


/*jslint node: true*/
'use strict';
var React         = require('react');
var AutoCompleteEditor  = require('./AutoCompleteEditor');

var AutoCompleteAsyncEditor =  React.createClass({

  propTypes : {
	cacheResults: React.PropTypes.bool,
  	column: React.PropTypes.object,
  	rowMetaData: React.PropTypes.object,
	height: React.PropTypes.number,
	label: React.PropTypes.string,
	onCommit: React.PropTypes.func,
	onKeyDown: React.PropTypes.func,
	resultIdentifier: React.PropTypes.string,
	searchSourceArgs: React.PropTypes.array,
	searchUrl: React.PropTypes.func,
	value: React.PropTypes.string,
	valueParams: React.PropTypes.arrayOf(React.PropTypes.string)
  },

  getSearchParams() {
    var rowMetaData = this.props.rowMetaData;
    var searchParams =  this.props.searchSourceArgs.map(arg => {
      if(rowMetaData[arg] == null){
        throw ("Cannot find Search Source Paramater " + arg + " in rowMetaData. You must add an entry for this in models/GridColumn.js")
      }
      return rowMetaData[arg]
    });
    return searchParams;
  },

  getInputNode(): HTMLInputElement{
    return this.getDOMNode().getElementsByTagName("input")[0];
  },

  getValue(){
    return this.refs.autocomplete.getValue();
  },

  hasResults(){
    return this.refs.autocomplete.hasResults();
  },

  _searchRemote(options, searchTerm, cb) {
    var searchParams = this.getSearchParams();
    //add onSuccessCallback at end of search params array
    searchParams.push(this._onXHRSuccess.bind(null, cb, searchTerm));
    this.props.searchUrl.apply(this, searchParams);
  },

  _onXHRSuccess(cb, searchTerm, data, status, xhr) {
    cb(null, this._filterData(data, searchTerm))
  },

  _onXHRError(cb, xhr, status, err) {
    cb(err)
  },

  _filterData(data, searchTerm) {
    var regexp = new RegExp(searchTerm, 'i')
    var results = []
    var label = this.props.label ? this.props.label : 'title';
	for (var i = 0, len = data.length; i < len; i++) {
      if (regexp.exec(data[i][label])) {
        results.push(data[i])
      }
    }
    return results.slice(0, 100)
  },

  render() {
    var value;
    var Formatter = this.props.column.formatter;
    if(typeof Formatter === 'function' && typeof Formatter.format === 'function'){
      value = Formatter.format(this.props.value);
    }else{
      value = this.props.value;
    }
    return (
      <AutoCompleteEditor
		ref="autocomplete" {...this.props}
		options={[]}
		search={this._searchRemote}
		value={value}
		label={this.props.label}
		resultIdentifier={this.props.resultIdentifier}
	  />
    )
  }
});

module.exports = AutoCompleteAsyncEditor;
