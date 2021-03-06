/* @flow */
/**
 * @jsx React.DOM

 */
"use strict";

var React                 = require('react');
var PropTypes             = React.PropTypes;
var BaseGrid              = require('../../Grid');
var Row                   = require('../../Row');
var ExcelColumn           = require('./ExcelColumn');
var merge                 = require('../../merge');
var KeyboardHandlerMixin  = require('../../KeyboardHandlerMixin');
var CheckboxEditor        = require('../editors/CheckboxEditor');
var SortableHeaderCell    = require('../cells/headerCells/SortableHeaderCell');
var FilterableHeaderCell  = require('../cells/headerCells/FilterableHeaderCell');
var cloneWithProps        = require('react/lib/cloneWithProps');

type SelectedType = {
  rowIdx: number;
  idx: number;
};

type DraggedType = {
  idx: number;
  rowIdx: number;
  value: string;
};

type ReactDataGridProps = {
  rowHeight: number;
  minHeight: number;
  enableRowSelect: ?boolean;
  onRowUpdated: ?() => void;
  columns: Array<ExcelColumn>;
  rowGetter: () => Array<any>;
  rowsCount: number;
  toolbar: ?any;
  enableCellSelect: ?boolean;
  onCellCopyPaste: ?() => any;
  onCellsDragged: ?() => any;
  onFilter: ?() => any;
};

type SortType = {ASC: string; DESC: string};
var DEFINE_SORT = {
  ASC : 'ASC',
  DESC : 'DESC'
}

type RowUpdateEvent = {
  keyCode: string;
  changed: {expandedHeight: number};
  rowIdx: number;
};

var ReactDataGrid = React.createClass({

  propTypes: {
    rowHeight: React.PropTypes.number.isRequired,
    minHeight: React.PropTypes.number.isRequired,
    enableRowSelect: React.PropTypes.bool,
    onRowUpdated:React.PropTypes.func,
    rowGetter: React.PropTypes.func.isRequired,
    rowsCount : React.PropTypes.number.isRequired,
    toolbar:React.PropTypes.element,
    enableCellSelect : React.PropTypes.bool,
    columns : React.PropTypes.arrayOf(React.PropTypes.shape(ExcelColumn)).isRequired,
    onFilter : React.PropTypes.func,
    onCellCopyPaste : React.PropTypes.func,
    onCellsDragged : React.PropTypes.func
  },

  mixins : [KeyboardHandlerMixin],

  getDefaultProps(): {enableCellSelect: boolean} {
    return {
      enableCellSelect : false,
      tabIndex : -1,
      ref : "cell",
      rowHeight: 35,
      enableRowSelect : false,
      minHeight : 350
    };
  },

  getInitialState: function(): {selected: SelectedType; copied: ?{idx: number; rowIdx: number}; selectedRows: Array<Row>; expandedRows: Array<Row>; canFilter: boolean; columnFilters: any; sortDirection: ?SortType; sortColumn: ?ExcelColumn; dragged: ?DraggedType } {
    var initialState = {selectedRows : [], copied : null, expandedRows : [], canFilter : false, columnFilters : {}, sortDirection: null, sortColumn: null, dragged : null}
    if(this.props.enableCellSelect){
      initialState.selected = {rowIdx: 0, idx: 0};
    }else{
      initialState.selected = {rowIdx: -1, idx: -1};
    }
    return initialState;
  },

  componentWillReceiveProps:function(nextProps: ReactDataGridProps){
    if(nextProps.rowsCount  === this.props.rowsCount + 1){
      this.onAfterAddRow(nextProps.rowsCount + 1);
    }
  },

  render: function(): ?ReactElement {
    var cellMetaData = {
      selected : this.state.selected,
      dragged : this.state.dragged,
      onCellClick : this.onCellClick,
      onCommit : this.onCellCommit,
      onCommitCancel : this.setInactive,
      copied : this.state.copied,
      handleDragEnterRow : this.handleDragEnter,
      handleTerminateDrag : this.handleTerminateDrag
    }

    var toolbar = this.renderToolbar();
    return(
      <div className="react-grid-Container">
      {toolbar}
        <div className="react-grid-Main">
          <BaseGrid
            ref="base"
            {...this.props}
            headerRows={this.getHeaderRows()}
            columns={this.getColumns()}
            rowGetter={this.props.rowGetter}
            rowsCount={this.props.rowsCount}
            cellMetaData={cellMetaData}
            selectedRows={this.state.selectedRows}
            expandedRows={this.state.expandedRows}
            rowOffsetHeight={this.getRowOffsetHeight()}
            minHeight={this.props.minHeight}
            onViewportKeydown={this.onKeyDown}
            onViewportDragStart={this.onDragStart}
            onViewportDragEnd={this.handleDragEnd}/>
          </div>
        </div>
      )
  },

  renderToolbar(): ReactElement {
    var Toolbar = this.props.toolbar;
    if(React.isValidElement(Toolbar)){
      return( cloneWithProps(Toolbar, {onToggleFilter : this.onToggleFilter, numberOfRows : this.props.rowsCount}));
    }

  },

  onSelect: function(selected: SelectedType) {
    if(this.props.enableCellSelect){
      var idx = selected.idx;
      var rowIdx = selected.rowIdx;
      if (
        idx >= 0
        && rowIdx >= 0
        && idx < this.getColumns().length
        && rowIdx < this.props.rowsCount
      ) {
        this.setState({selected: selected});
      }
    }
  },

  isSelected: function(): boolean {
    return (
      this.props.selected
      && this.props.selected.rowIdx === this.props.rowIdx
      && this.props.selected.idx === this.props.idx
    );
  },

  onCellClick: function(cell: SelectedType) {
    this.onSelect({rowIdx: cell.rowIdx, idx: cell.idx});
  },

  onPressArrowUp(e: SyntheticEvent){
    this.moveSelectedCell(e, -1, 0);
  },

  onPressArrowDown(e: SyntheticEvent){
    this.moveSelectedCell(e, 1, 0);
  },

  onPressArrowLeft(e: SyntheticEvent){
    this.moveSelectedCell(e, 0, -1);
  },

  onPressArrowRight(e: SyntheticEvent){
    this.moveSelectedCell(e, 0, 1);
  },

  onPressTab(e: SyntheticEvent){
    this.moveSelectedCell(e, 0, 1);
  },

  onPressEnter(e: SyntheticKeyboardEvent){
    this.setActive(e.key);
  },

  onPressDelete(e: SyntheticKeyboardEvent){
    this.setActive(e.key);
  },

  onPressEscape(e: SyntheticKeyboardEvent){
    this.setInactive(e.key);
  },

  onPressBackspace(e: SyntheticKeyboardEvent){
    this.setActive(e.key);
  },

  onPressChar(e: SyntheticKeyboardEvent){
    if(this.isKeyPrintable(e.keyCode)){
      this.setActive(e.keyCode);
    }
  },

  onPressKeyWithCtrl(e: SyntheticKeyboardEvent){
    var keys = {
      KeyCode_c : '99',
      KeyCode_C : '67',
      KeyCode_V : '86',
      KeyCode_v : '118',
    }

    var idx = this.state.selected.idx
    if(this.canEdit(idx)){
      var value = this.getSelectedValue();
      if(e.keyCode === keys.KeyCode_c || e.keyCode === keys.KeyCode_C){
        this.handleCopy({value : value});
      }else if(e.keyCode === keys.KeyCode_v || e.keyCode === keys.KeyCode_V){
        this.handlePaste({value : value});
      }
    }
  },

  onDragStart(e: SyntheticEvent){
    if(e.target)
    var value = this.getSelectedValue();
    this.handleDragStart({idx: this.state.selected.idx, rowIdx : this.state.selected.rowIdx, value : value});
  },

  moveSelectedCell(e: SyntheticEvent, rowDelta: number, cellDelta: number){
    e.stopPropagation();
    e.preventDefault();
    var rowIdx = this.state.selected.rowIdx + rowDelta;
    var idx = this.state.selected.idx + cellDelta;
    this.onSelect({idx: idx, rowIdx: rowIdx});
  },

  getSelectedValue(): string{
    var rowIdx = this.state.selected.rowIdx;
    var idx = this.state.selected.idx;
    var cellOffset = this.props.enableRowSelect ? 1 : 0;
    var cellKey = this.props.columns[idx - cellOffset].key;
    return this.props.rowGetter(rowIdx)[cellKey];
  },

  setActive(keyPressed: string){
    var rowIdx = this.state.selected.rowIdx;
    var idx = this.state.selected.idx;
    if(this.props.columns[idx].key === 'select-row' && this.props.columns[idx].onRowSelect){
      this.props.column.onRowSelect(rowIdx);
    }
    else if(this.canEdit(idx) && !this.isActive()){
      var selected = Object.assign(this.state.selected, {idx: idx, rowIdx: rowIdx, active : true, initialKeyCode : keyPressed});
      this.setState({selected: selected});
    }
  },

  setInactive(){
    var rowIdx = this.state.selected.rowIdx;
    var idx =this.state.selected.idx;
    if(this.canEdit(idx) && this.isActive()){
      var selected = Object.assign(this.state.selected, {idx: idx, rowIdx: rowIdx, active : false});
      this.setState({selected: selected});
    }
  },

  canEdit(idx: number): boolean{
    return (this.props.columns[idx].editor != null) || this.props.columns[idx].editable;
  },

  isActive(): boolean{
    return this.state.selected.active === true;
  },

  onCellCommit(commit: RowUpdateEvent){
    var selected = Object.assign({}, this.state.selected);
    selected.active = false;
    if (commit.keyCode === 'Tab') {
      selected.idx += 1;
    }
    var expandedRows = this.state.expandedRows;
    if(commit.changed && commit.changed.expandedHeight){
      expandedRows = this.expandRow(commit.rowIdx, commit.changed.expandedHeight);
    }
    this.setState({selected : selected, expandedRows : expandedRows});
    this.props.onRowUpdated(commit);

  },
  getColumns : function(): Array<any>{
    var cols = this.getDecoratedColumns(this.props.columns)
    if(this.props.enableRowSelect){
        cols.unshift({
          key: 'select-row',
          name: '',
          formatter : <CheckboxEditor/>,
          onRowSelect :this.handleRowSelect,
          filterable : false,
          headerRenderer : <input type="checkbox" onChange={this.handleCheckboxChange} />,
          width : 60
        });
      }
      return cols;
  },

  handleCheckboxChange : function(e: SyntheticEvent){
    if(e.currentTarget instanceof HTMLInputElement && e.currentTarget.checked === true){
      var selectedRows = this.props.rows.map(() => true);
      this.setState({selectedRows : selectedRows});
    }else{
      var selectedRows = this.props.rows.map(() => false);
      this.setState({selectedRows : selectedRows});
    }
  },

  handleRowSelect(row: Row){
    var selectedRows = this.state.selectedRows;
    if(selectedRows[row] == null || selectedRows[row] == false){
      selectedRows[row] = true;
    }else{
      selectedRows[row] = false;
    }
    this.setState({selectedRows : selectedRows});
  },

  expandRow(row: Row, newHeight: number): Array<Row>{
    var expandedRows = this.state.expandedRows;
    if(expandedRows[row]){
      if(expandedRows[row]== null || expandedRows[row] < newHeight){
        expandedRows[row] = newHeight;
      }
    }else{
      expandedRows[row] = newHeight;
    }
    return expandedRows;
  },

  addRow(){

  },

  handleShowMore(row: Row, newHeight: number) {
    var expandedRows = this.expandRow(row, newHeight);
    this.setState({expandedRows : expandedRows});
  },

  handleShowLess(row: Row){
    var expandedRows = this.state.expandedRows;
    if(expandedRows[row]){
        expandedRows[row] = false;
    }
    this.setState({expandedRows : expandedRows});
  },

  expandAllRows(){

  },

  collapseAllRows(){

  },

  onAfterAddRow:function(numberOfRows: number){
    this.setState({selected : {idx : 1, rowIdx : numberOfRows - 2}});
  },

  hasFilters(): boolean{
    var hasFilters = false;
    Object.keys(this.state.columnFilters).every(function(key){
      var filter = this.state.columnFilters[key];
      if(filter != null && filter != undefined && filter != ''){
        hasFilters = true;
        return false;
      }
      return true;
    }, this);
    return hasFilters;
  },

  isRowDisplayed(row: Row): boolean{
    var isRowDisplayed = null;
    Object.keys(this.state.columnFilters).every(function(key){
      var filter = this.state.columnFilters[key].toLowerCase();
      var cellValue = row[key].toString().toLowerCase();
      if(filter != null && filter != undefined && filter != '' && typeof cellValue === 'string'){
        if(cellValue.indexOf(filter) > -1){
          isRowDisplayed = true;
        }else{
          isRowDisplayed = false;
          return false;
        }
      }
      return true;
    }, this);
    return isRowDisplayed == null ? false : isRowDisplayed;
  },

  onToggleFilter(){
    this.setState({canFilter : !this.state.canFilter});
  },

  handleAddFilter(filter: {columnKey: string; filterTerm: string }){
    var columnFilters = this.state.columnFilters;
    columnFilters[filter.columnKey] = filter.filterTerm;
    this.setState({columnFilters : columnFilters, selected : null});
  },

  getHeaderRows(): Array<{ref: string; height: number;}> {
    var rows = [{ref:"row", height: this.props.rowHeight}];
    if(this.state.canFilter === true){
      rows.push({
        ref:"filterRow",
        headerCellRenderer : <FilterableHeaderCell onChange={this.handleAddFilter} column={this.props.column}/>,
        height : 45
      });
    }
    return rows;
  },

  getRowOffsetHeight(): number{
    var offsetHeight = 0;
    this.getHeaderRows().forEach((row) => offsetHeight += parseFloat(row.height, 10) );
    return offsetHeight;
  },

  getDecoratedColumns: function(columns: Array<ExcelColumn>): Array<ExcelColumn> {
    return this.props.columns.map(function(column) {
      column = Object.assign({}, column);
      if (column.sortable) {
        column.headerRenderer = <SortableHeaderCell column={column}/>;
        column.sortBy = this.sortBy;
        if (this.state.sortColumn === column.key) {
          column.sorted = this.state.sortDirection;
        }else{
          column.sorted = DEFINE_SORT.NONE;
        }
      }
      return column
    }, this);
  },

  sortBy: function(column: ExcelColumn, direction: SortType) {
    switch(direction){
      case null:
      case undefined:
        direction = DEFINE_SORT.ASC;
      break;
      case DEFINE_SORT.ASC:
        direction = DEFINE_SORT.DESC;
      break;
      case DEFINE_SORT.DESC:
        direction = null;
      break;
    }
    this.setState({sortDirection: direction, sortColumn: column.key});
  },

  copyPasteEnabled: function(): boolean {
    return this.props.onCellCopyPaste !== null;
  },

  handleCopy(args: {value: string}){
    if(!this.copyPasteEnabled()) { return; }
      var textToCopy = args.value;
      var selected = this.state.selected;
      var copied = {idx : selected.idx, rowIdx : selected.rowIdx};
      this.setState({textToCopy:textToCopy, copied : copied});
  },

  handlePaste(){
    if(!this.copyPasteEnabled()) { return; }
      var selected = this.state.selected;
      var cellKey = this.getColumns()[selected.idx].key;
      if(this.props.onCellCopyPaste) {
        this.props.onCellCopyPaste({cellKey: cellKey , rowIdx: selected.rowIdx, value : this.state.textToCopy, fromRow : this.state.copied.rowIdx, toRow : selected.rowIdx});
      }
      this.setState({copied : null});
  },

  dragEnabled: function(): boolean {
    return this.props.onCellsDragged !== null;
  },

  handleDragStart(dragged: DraggedType){
    if(!this.dragEnabled()) { return; }
      var idx = dragged.idx;
      var rowIdx = dragged.rowIdx;
      if (
        idx >= 0
        && rowIdx >= 0
        && idx < this.getColumns().length
        && rowIdx < this.props.rowsCount
      ) {
        this.setState({dragged: dragged});
      }
  },

  handleDragEnter(row: any){
    if(!this.dragEnabled()) { return; }
      var selected = this.state.selected;
      var dragged = this.state.dragged;
      dragged.overRowIdx = row;
      this.setState({dragged : dragged});
  },

  handleDragEnd(){
    if(!this.dragEnabled()) { return; }
      var fromRow, toRow;
      var selected = this.state.selected;
      var dragged = this.state.dragged;
      var cellKey = this.getColumns()[this.state.selected.idx].key;
      fromRow = selected.rowIdx < dragged.overRowIdx ? selected.rowIdx : dragged.overRowIdx;
      toRow   = selected.rowIdx > dragged.overRowIdx ? selected.rowIdx : dragged.overRowIdx;
      if(this.props.onCellsDragged) { this.props.onCellsDragged({cellKey: cellKey , fromRow: fromRow, toRow : toRow, value : dragged.value}); }
        this.setState({dragged : {complete : true}});
  },

  handleTerminateDrag(){
    if(!this.dragEnabled()) { return; }
      this.setState({dragged: null});
  }

});


module.exports = ReactDataGrid;
