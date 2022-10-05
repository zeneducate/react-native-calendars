import {StyleSheet} from 'react-native';
import * as defaultStyle from '../style';
import {Theme} from '../types';

export default function getStyle(theme: Theme = {}) {
  const appStyle = {...defaultStyle, ...theme};
  return StyleSheet.create({
    container: {
      paddingLeft: 5,
      paddingRight: 5,
      backgroundColor: appStyle.calendarBackground
    },
    dayContainer: {
      flex: 1,
      alignItems: 'center'
    },
    emptyDayContainer: {
      flex: 1
    },
    monthView: {
      backgroundColor: appStyle.calendarBackground
    },
    week: {
<<<<<<< HEAD:src/calendar/style.js
      marginTop: 14,
=======
      marginVertical: appStyle.weekVerticalMargin,
>>>>>>> 9b52caf0a98bdcfdd317894512fd4b38eb3e346d:src/calendar/style.ts
      flexDirection: 'row',
      justifyContent: 'space-around'
    },
    // @ts-expect-error
    ...(theme['stylesheet.calendar.main'] || {})
  });
}
