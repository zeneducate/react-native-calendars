import _ from 'lodash';
import PropTypes from 'prop-types';
import XDate from 'xdate';
import React, {Component} from 'react';
import {FlatList, Platform, Dimensions, View} from 'react-native';
import {extractComponentProps} from '../component-updater';
import {xdateToData, parseDate} from '../interface';
import dateutils from '../dateutils';
import {STATIC_HEADER} from '../testIDs';
import styleConstructor from './style';
import Calendar from '../calendar';
import CalendarListItem from './item';
import CalendarHeader from '../calendar/header/index';

const {width} = Dimensions.get('window');

const weekCount = date => {
  // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  const year = date.getYear();
  const month = date.getMonth();
  const wday = date.setDate(1).getDay();
  const used = XDate.getDaysInMonth(year, month) + (wday === 0 ? 6 : wday - 1);

  return Math.ceil(used / 7);
};

/**
 * @description: Calendar List component for both vertical and horizontal calendars
 * @extends: Calendar
 * @extendslink: docs/Calendar
 * @example: https://github.com/wix/react-native-calendars/blob/master/example/src/screens/calendarsList.js
 * @gif: https://github.com/wix/react-native-calendars/blob/master/demo/calendar-list.gif
 */
class CalendarList extends Component {
  static displayName = 'CalendarList';

  static propTypes = {
    ...Calendar.propTypes,
    /** Max amount of months allowed to scroll to the past. Default = 50 */
    pastScrollRange: PropTypes.number,
    /** Max amount of months allowed to scroll to the future. Default = 50 */
    futureScrollRange: PropTypes.number,
    /** Used when calendar scroll is horizontal, default is device width, pagination should be disabled */
    calendarWidth: PropTypes.number,
    /** Dynamic calendar height */
    calendarHeight: PropTypes.number,
    /** Height of a day */
    dayHeight: PropTypes.number,
    /** Height of the month header */
    monthHeaderHeight: PropTypes.number,
    /** Bottom margin on months */
    monthBottomMargin: PropTypes.number,
    /** Style for the List item (the calendar) */
    calendarStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.array]),
    /** Whether to use static header that will not scroll with the list (horizontal only) */
    staticHeader: PropTypes.bool,
    /** Enable or disable vertical / horizontal scroll indicator. Default = false */
    showScrollIndicator: PropTypes.bool,

    /** Enable or disable scrolling of calendar list */
    scrollEnabled: PropTypes.bool,
    /** When true, the calendar list scrolls to top when the status bar is tapped. Default = true */
    scrollsToTop: PropTypes.bool,
    /** Enable or disable paging on scroll */
    pagingEnabled: PropTypes.bool,
    /** Whether the scroll is horizontal */
    horizontal: PropTypes.bool,
    /** Should Keyboard persist taps */
    keyboardShouldPersistTaps: PropTypes.oneOf(['never', 'always', 'handled']),
    /** A custom key extractor for the generated calendar months */
    keyExtractor: PropTypes.func,
    /** How far from the end to trigger the onEndReached callback */
    onEndReachedThreshold: PropTypes.number,
    /** Called once when the scroll position gets within onEndReachedThreshold */
    onEndReached: PropTypes.func,
    /** A RefreshControl component, used to provide pull-to-refresh functionality for the ScrollView */
    refreshControl: PropTypes.element,
    /** Set this true while waiting for new data from a refresh */
    refreshing: PropTypes.bool,
    /** If provided, a standard RefreshControl will be added for "Pull to Refresh" functionality. Make sure to also set the refreshing prop correctly */
    onRefresh: PropTypes.func
  };

  static defaultProps = {
    calendarWidth: width,
    calendarHeight: 360,
    dayHeight: 58,
    monthBottomMargin: 28,
    monthHeaderHeight: 64.7,
    pastScrollRange: 50,
    futureScrollRange: 50,
    showScrollIndicator: false,
    horizontal: false,
    scrollsToTop: false,
    scrollEnabled: true,
    removeClippedSubviews: Platform.OS === 'android',
    keyExtractor: (item, index) => String(index)
  };

  constructor(props) {
    super(props);

    this.style = styleConstructor(props.theme);
    this.dayHeight = props.dayHeight;
    this.monthBottomMargin = props.monthBottomMargin;
    this.monthHeaderHeight = props.monthHeaderHeight;

    this.viewabilityConfig = {
      itemVisiblePercentThreshold: 20
    };

    const rows = [];
    const rowsMeta = [];
    const texts = [];
    const date = parseDate(props.current) || XDate();

    for (let i = 0; i <= props.pastScrollRange + props.futureScrollRange; i++) {
      const rangeDate = date.clone().addMonths(i - props.pastScrollRange, true);
      const rangeDateStr = rangeDate.toString('MMM yyyy');
      texts.push(rangeDateStr);
      /*
       * This selects range around current shown month [-0, +2] or [-1, +1] month for detail calendar rendering.
       * If `this.pastScrollRange` is `undefined` it's equal to `false` or 0 in next condition.
       */
      if (
        (props.pastScrollRange - 1 <= i && i <= props.pastScrollRange + 1) ||
        (!props.pastScrollRange && i <= props.pastScrollRange + 2)
      ) {
        rows.push(rangeDate);
      } else {
        rows.push(rangeDateStr);
      }

      rowsMeta.push({weekCount: weekCount(rangeDate)});
    }

    this.state = {
      rows,
      rowsMeta,
      texts,
      openDate: date,
      currentMonth: parseDate(props.current)
    };
  }

  componentDidUpdate(prevProps) {
    const prevCurrent = parseDate(prevProps.current);
    const current = parseDate(this.props.current);

    if (current && prevCurrent && current.getTime() !== prevCurrent.getTime()) {
      this.scrollToMonth(current);
    }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const rowclone = prevState.rows;
    const newrows = [];

    for (let i = 0; i < rowclone.length; i++) {
      let val = prevState.texts[i];
      if (rowclone[i].getTime) {
        val = rowclone[i].clone();
        val.propbump = rowclone[i].propbump ? rowclone[i].propbump + 1 : 1;
      }
      newrows.push(val);
    }
    return {rows: newrows};
  }

  scrollToDay(d, offset, animated) {
    const {horizontal, calendarHeight, calendarWidth, pastScrollRange, firstDay} = this.props;
    const day = parseDate(d);
    const diffMonths = Math.round(this.state.openDate.clone().setDate(1).diffMonths(day.clone().setDate(1)));
    const size = horizontal ? calendarWidth : calendarHeight;
    let scrollAmount = size * pastScrollRange + diffMonths * size + (offset || 0);

    if (!horizontal) {
      let week = 0;
      const days = dateutils.page(day, firstDay);
      for (let i = 0; i < days.length; i++) {
        week = Math.floor(i / 7);
        if (dateutils.sameDate(days[i], day)) {
          scrollAmount += 46 * week;
          break;
        }
      }
    }
    this.listView.scrollToOffset({offset: scrollAmount, animated});
  }

  scrollToMonth = m => {
    const {horizontal, calendarHeight, calendarWidth, pastScrollRange} = this.props;
    const month = parseDate(m);
    const scrollTo = month || this.state.openDate;
    let diffMonths = Math.round(this.state.openDate.clone().setDate(1).diffMonths(scrollTo.clone().setDate(1)));
    const size = horizontal ? calendarWidth : calendarHeight;
    const scrollAmount = size * pastScrollRange + diffMonths * size;

    this.listView.scrollToOffset({offset: scrollAmount, animated: false});
  };

  getCalendarHeightForMonthAtIndex = index => {
    return (
      this.monthBottomMargin + this.monthHeaderHeight + (this.state.rowsMeta[index]?.weekCount || 0) * this.dayHeight
    );
  };

  getItemLayout = (data, index) => {
    const {horizontal, calendarWidth} = this.props;
    const calendarHeight = this.getCalendarHeightForMonthAtIndex(index);

    return {
      length: horizontal ? calendarWidth : calendarHeight,
      offset: (horizontal ? calendarWidth : calendarHeight) * index,
      index
    };
  };

  getMonthIndex(month) {
    let diffMonths = this.state.openDate.diffMonths(month) + this.props.pastScrollRange;
    return diffMonths;
  }

  addMonth = count => {
    this.updateMonth(this.state.currentMonth.clone().addMonths(count, true));
  };

  updateMonth(day, doNotTriggerListeners) {
    if (day.toString('yyyy MM') === this.state.currentMonth.toString('yyyy MM')) {
      return;
    }

    this.setState(
      {
        currentMonth: day.clone()
      },
      () => {
        this.scrollToMonth(this.state.currentMonth);

        if (!doNotTriggerListeners) {
          const currMont = this.state.currentMonth.clone();

          _.invoke(this.props, 'onMonthChange', xdateToData(currMont));
          _.invoke(this.props, 'onVisibleMonthsChange', [xdateToData(currMont)]);
        }
      }
    );
  }

  onViewableItemsChanged = ({viewableItems}) => {
    function rowIsCloseToViewable(index, distance) {
      for (let i = 0; i < viewableItems.length; i++) {
        if (Math.abs(index - parseInt(viewableItems[i].index)) <= distance) {
          return true;
        }
      }
      return false;
    }

    const rowclone = this.state.rows;
    const newrows = [];
    const newRowsMeta = [];
    const visibleMonths = [];

    for (let i = 0; i < rowclone.length; i++) {
      let val = rowclone[i];
      const rowShouldBeRendered = rowIsCloseToViewable(i, 1);
      const date = this.state.openDate.clone().addMonths(i - this.props.pastScrollRange, true);

      if (rowShouldBeRendered && !rowclone[i].getTime) {
        val = date;
      } else if (!rowShouldBeRendered) {
        val = this.state.texts[i];
      }
      newrows.push(val);
      newRowsMeta.push({weekCount: weekCount(date)});
      if (rowIsCloseToViewable(i, 0)) {
        visibleMonths.push(xdateToData(val));
      }
    }

    _.invoke(this.props, 'onVisibleMonthsChange', visibleMonths);

    this.setState({
      rows: newrows,
      rowsMeta: newRowsMeta,
      currentMonth: parseDate(visibleMonths[0])
    });
  };

  renderItem = ({item, index}) => {
    const {calendarStyle, horizontal, calendarWidth, testID, ...others} = this.props;
    const calendarHeight = this.getCalendarHeightForMonthAtIndex(index);

    return (
      <CalendarListItem
        {...others}
        item={item}
        testID={`${testID}_${item}`}
        style={calendarStyle}
        calendarHeight={calendarHeight}
        calendarWidth={horizontal ? calendarWidth : undefined}
        scrollToMonth={this.scrollToMonth}
      />
    );
  };

  renderStaticHeader() {
    const {staticHeader, horizontal, headerStyle} = this.props;
    const useStaticHeader = staticHeader && horizontal;
    const headerProps = extractComponentProps(CalendarHeader, this.props);

    if (useStaticHeader) {
      return (
        <CalendarHeader
          {...headerProps}
          testID={STATIC_HEADER}
          style={[this.style.staticHeader, headerStyle]}
          month={this.state.currentMonth}
          addMonth={this.addMonth}
          accessibilityElementsHidden={true} // iOS
          importantForAccessibility={'no-hide-descendants'} // Android
        />
      );
    }
  }

  render() {
    const {style, pastScrollRange, futureScrollRange, horizontal, showScrollIndicator, testID} = this.props;

    return (
      <View>
        <FlatList
          ref={c => (this.listView = c)}
          style={[this.style.container, style]}
          initialListSize={pastScrollRange + futureScrollRange + 1} // ListView deprecated
          data={this.state.rows}
          renderItem={this.renderItem}
          getItemLayout={this.getItemLayout}
          onViewableItemsChanged={this.onViewableItemsChanged}
          viewabilityConfig={this.viewabilityConfig}
          initialScrollIndex={this.state.openDate ? this.getMonthIndex(this.state.openDate) : false}
          showsVerticalScrollIndicator={showScrollIndicator}
          showsHorizontalScrollIndicator={horizontal && showScrollIndicator}
          testID={testID}
          onLayout={this.props.onLayout}
          removeClippedSubviews={this.props.removeClippedSubviews}
          pagingEnabled={this.props.pagingEnabled}
          scrollEnabled={this.props.scrollEnabled}
          scrollsToTop={this.props.scrollsToTop}
          horizontal={this.props.horizontal}
          keyboardShouldPersistTaps={this.props.keyboardShouldPersistTaps}
          keyExtractor={this.props.keyExtractor}
          onEndReachedThreshold={this.props.onEndReachedThreshold}
          onEndReached={this.props.onEndReached}
          refreshControl={this.props.refreshControl}
          refreshing={this.props.refreshing}
          onRefresh={this.props.onRefresh}
        />
        {this.renderStaticHeader()}
      </View>
    );
  }
}

export default CalendarList;
