// Preserve host branding where its colors remain readable.
(() => {
 const luminance=hex=>{const c=hex.slice(1).match(/../g).map(v=>{const n=parseInt(v,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const valid=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
 const ink=bg=>contrast('#000000',bg)>contrast('#ffffff',bg)?'#000000':'#ffffff';
 function palette(data){const background=valid(data.background,'#ffffff');let text=valid(data.text,'#271c22'),accent=valid(data.accent,'#c8102e');if(contrast(text,background)<7)text=ink(background);if(contrast(accent,background)<4.8)accent=text;return {background,text,accent,accentInk:ink(accent)};}
 window.CrownBookingStyle={palette,contrast,apply(data){const colors=palette(data);for(const [key,variable] of [['background','--page-bg'],['text','--page-text'],['accent','--page-accent'],['accentInk','--page-accent-ink']])document.documentElement.style.setProperty(variable,colors[key]);}};
})();
