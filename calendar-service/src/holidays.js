import Holidays from 'date-holidays';
import countries from 'countries-and-timezones';
import { Temporal } from '@js-temporal/polyfill';

const supported = new Holidays().getCountries('en');
const countryList = Object.entries(supported).map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name));
const cache = new Map();
export function holidayOptions(timezone) {
 const candidates = countries.getTimezone(timezone)?.countries || [];
 return {
  countries: countryList,
  candidates,
  detected: candidates.length === 1 && supported[candidates[0]] ? candidates[0] : null
 };
}
export function holidayCountry(workspace) {
 if (!workspace.holidays?.enabled) return null;
 const country = workspace.holidays.country;
 return country === 'auto' ? holidayOptions(workspace.timezone).detected : Object.hasOwn(supported,country) ? country : null;
}
export function validHolidaySettings(value) {
 return value && typeof value === 'object' && typeof value.enabled === 'boolean' &&
  (value.country === 'auto' || typeof value.country === 'string' && Object.hasOwn(supported,value.country));
}
function yearDates(country,year) {
 const key = `${country}:${year}`;
 if (cache.has(key)) return cache.get(key);
 // Nominal calendar dates, not UTC instants: religious calendars may start on the eve.
 // The product blocks full local dates; it does not calculate sunset closures.
 const calendar = new Holidays(country,{timezone:'UTC',types:['public'],languages:['en']});
 const dates = new Map();
 for (const holiday of calendar.getHolidays(year)) {
  if (holiday.type !== 'public') continue;
  const first = Temporal.PlainDate.from(holiday.date.slice(0,10));
  const length = Math.max(1,Math.ceil((holiday.end-holiday.start)/86400000));
  for (let i=0;i<length;i++) {
   const date = first.add({days:i}).toString();
   dates.set(date,[...(dates.get(date)||[]),holiday.name]);
  }
 }
 if (cache.size >= 256) cache.delete(cache.keys().next().value);
 cache.set(key,dates);
 return dates;
}
export function holidayDates(workspace,from,to) {
 const country = holidayCountry(workspace),dates = new Map();
 if (!country) return dates;
 for (let year=Number(from.slice(0,4))-1;year<=Number(to.slice(0,4));year++) {
  for (const [date,names] of yearDates(country,year)) if (date>=from && date<=to) dates.set(date,[...new Set(names)].join(' / '));
 }
 return dates;
}
export function holidayEvents(workspace,start,end) {
 const zone=workspace.timezone;
 const local=stamp=>Temporal.Instant.fromEpochMilliseconds(stamp).toZonedDateTimeISO(zone).toPlainDate().toString();
 return [...holidayDates(workspace,local(start),local(end-1))].map(([date,title])=>{
  const day=Temporal.PlainDate.from(date);
  return {start:Number(day.toZonedDateTime({timeZone:zone,plainTime:'00:00'}).epochMilliseconds),
   end:Number(day.add({days:1}).toZonedDateTime({timeZone:zone,plainTime:'00:00'}).epochMilliseconds),
   title,calendar:`Public holidays (${holidayCountry(workspace)})`,allDay:true,
   busy:!Object.hasOwn(workspace.exceptions||{},date)||workspace.exceptions[date].length===0};
 });
}
