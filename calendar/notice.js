(() => {
  const factors={minutes:1,hours:60,days:1440};
  function toMinutes(value,unit){const minutes=value*factors[unit];if(!Number.isInteger(value)||value<0||!Number.isSafeInteger(minutes)||minutes>43200)throw Error('Choose a whole-number notice between 0 and 30 days.');return minutes;}
  function display(minutes){const unit=minutes>0&&minutes%1440===0?'days':minutes>0&&minutes%60===0?'hours':'minutes';return {value:minutes/factors[unit],unit};}
  const api={toMinutes,display,factors};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')window.CrownNotice=api;
})();
