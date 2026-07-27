/*
 * Content for the standalone service and case-study pages.
 *
 * Every factual claim here traces back to copy already on the site or to the
 * project descriptions in assets/Projects. Nothing is invented: no metrics, no
 * outcomes, no testimonials. If a claim is not already true elsewhere on the
 * site, it does not belong in this file.
 */
'use strict';

const SERVICES = [
  {
    slug: 'vr-development',
    nav: 'VR Development',
    title: 'VR Development for Science & Engineering | Red Crown Interactive',
    desc: 'Unity VR development for universities and engineering teams: multi-user Meta Quest 3 labs, instructor tools, and guided experiments built for real teaching.',
    h1: ['VR development for ', 'science and engineering'],
    lead: 'We build virtual reality software in Unity for universities, research groups, and engineering teams: guided experiments, training simulations, and multi-user classrooms that have to work the same way for every student, every week.',
    serviceType: 'Virtual Reality development',
    blocks: [
      { kind: 'cards', head: 'WHAT WE BUILD', items: [
        { h: 'Guided experiments', p: 'Hour-long procedures a student works through themselves, operating the equipment, making decisions, and reading real instrument values, with a virtual instructor setting the pace.' },
        { h: 'Multi-user classrooms', p: 'Up to 12 Meta Quest 3 headsets running in parallel, each paired with the instructor’s tablet, so a whole cohort goes through the same session together.' },
        { h: 'Training simulations', p: 'Procedures that are expensive, slow, or unsafe to rehearse on real equipment, rebuilt so they can be repeated as often as the trainee needs.' },
      ]},
      { kind: 'prose', head: 'BUILT SO A WHOLE CLASS CAN WEAR IT', paras: [
        'Comfort decides whether VR survives contact with a real timetable. If a handful of students feel unwell, the session stops being usable for teaching. Movement inside our experiences is deliberately designed to keep motion sickness to a minimum, so a full hour in the headset stays comfortable for an entire class.',
        'The same thinking covers the parts nobody demos: headset logistics, charging, resetting between groups, and what an instructor does when one device misbehaves five minutes into a lesson.',
      ]},
      { kind: 'prose', head: 'PLATFORMS AND TOOLS', paras: [
        'Built in <b>Unity</b>, primarily for <b>Meta Quest 3</b>, with hand tracking, gesture, and controller interaction chosen to fit the task rather than to show off. Where a project needs to reach beyond the headset we also build for desktop, WebGL, iOS, and Android.',
      ]},
      { kind: 'related', head: 'SEE IT IN USE', items: ['fugacity-vr-lab', 'meta-quest-classroom'] },
    ],
    cta: { h: 'Got a course, a lab, or a procedure to rebuild in VR?', p: 'Tell us what you want to build, even if it is still a rough idea.' },
  },
  {
    slug: 'ar-mr-development',
    nav: 'AR & Mixed Reality',
    title: 'AR & Mixed Reality Development in Unity | Red Crown Interactive',
    desc: 'Mixed reality development for Meta Quest 3: content anchored to the real desk, hand-tracked interaction, and virtual instructors, built in Unity for teaching and field work.',
    h1: ['Mixed reality that stays anchored to ', 'the real world'],
    lead: 'We build augmented and mixed reality software that puts virtual content into the room the user is already standing in, so what they learn stays connected to the bench, the machine, or the sample in front of them.',
    serviceType: 'Augmented Reality development',
    blocks: [
      { kind: 'cards', head: 'WHAT WE BUILD', items: [
        { h: 'Content on the real desk', p: 'Models overlaid on any existing real table, so students interact with virtual scientific content while keeping a clear connection to their physical environment.' },
        { h: 'Physics-based hand interaction', p: 'Picking up molecules, rotating and zooming models, and working through interactive steps with your hands, with no controllers and no prior experience needed.' },
        { h: 'Virtual instructors', p: 'A guide inside the experience that explains, sets the pace, and waits for the learner, so a session works without an expert standing over every user.' },
      ]},
      { kind: 'prose', head: 'WHY PASSTHROUGH CHANGES THE LESSON', paras: [
        'In mixed reality the learner stays seated at their own desk and sees the real room around them the whole time. That keeps motion sickness to a minimum and lets people who normally avoid headsets take part.',
        'It also keeps the virtual content next to the real apparatus, so the numbers a student measures at the bench and the molecular world driving them are visible in the same glance.',
      ]},
      { kind: 'prose', head: 'PLATFORMS AND TOOLS', paras: [
        'Built in <b>Unity</b> for <b>Meta Quest 3</b> passthrough, with hand tracking as the primary input. We also build companion AR tools for iOS and Android where the work happens away from a headset.',
      ]},
      { kind: 'related', head: 'SEE IT IN USE', items: ['enzymatic-lab-ar'] },
    ],
    cta: { h: 'Have something physical you want to explain better?', p: 'If it lives on a bench, in a machine, or under a microscope, it can probably be shown in mixed reality.' },
  },
  {
    slug: 'scientific-visualization',
    nav: 'Scientific Visualization',
    title: 'Scientific Visualization & Research Tools | Red Crown Interactive',
    desc: 'Interactive scientific visualization and research software: real-time 3D molecular tools, machine-learning calculation, and data made explorable rather than static.',
    h1: ['Scientific visualization you can ', 'interrogate'],
    lead: 'We build interactive tools that let researchers construct, modify, and explore scientific models in real time, and see results come back onto the model rather than into a log file.',
    serviceType: 'Scientific visualization',
    blocks: [
      { kind: 'cards', head: 'WHAT WE BUILD', items: [
        { h: 'Interactive 3D research tools', p: 'Software where a researcher builds and edits a structure directly and the result appears on the model in front of them, without leaving the flow of the work.' },
        { h: 'Machine-learning calculation', p: 'Models that return a scientific calculation far faster than the traditional approach, so exploration replaces waiting for one result at a time.' },
        { h: 'Simulation and real-time 3D', p: 'High-performance visual systems where precision, stability, and frame rate matter as much as how the result looks.' },
      ]},
      { kind: 'prose', head: 'BUILT FOR THE WAY RESEARCH ACTUALLY RUNS', paras: [
        'Research rarely proceeds one calculation at a time. The value of a tool is how quickly it lets someone try the next idea, so we design for the loop of build, evaluate, adjust, rather than for a single impressive render.',
        'That means a responsive interface, a calculation path fast enough to stay in the loop, and results shown on the structure they belong to.',
      ]},
      { kind: 'prose', head: 'PLATFORMS AND TOOLS', paras: [
        'Desktop and WebGL applications built in <b>Unity</b>, with <b>Python</b> services and machine-learning models behind them, plus C++ and C# where performance demands it.',
      ]},
      { kind: 'related', head: 'SEE IT IN USE', items: ['livemol-research-tool'] },
    ],
    cta: { h: 'Sitting on data or a model nobody can explore?', p: 'Tell us what your researchers need to see and do.' },
  },
  {
    slug: 'unity-app-development',
    nav: 'Unity Development',
    title: 'Unity Application Development for XR, Mobile & PC | Red Crown Interactive',
    desc: 'Unity development across XR, mobile, and desktop, led end to end by a senior engineer, from concept and 3D art through optimization and long-term support.',
    h1: ['Unity development, ', 'end to end'],
    lead: 'One studio for the whole build: concept and design, development, 3D art and animation, optimization, and the support that keeps an application alive after launch, across XR, mobile, and desktop.',
    serviceType: 'Unity development',
    blocks: [
      { kind: 'cards', head: 'WHAT THAT COVERS', items: [
        { h: 'Concept and design', p: 'Turning an idea into a compelling concept, with the visual storytelling to make it understandable before a line of code exists.' },
        { h: 'Development and 3D', p: 'End-to-end development, stable and modular so it can be extended later without rebuilding from scratch, with high-quality 3D assets, animation, and effects.' },
        { h: 'Optimization and support', p: 'A performance-first approach for smooth experiences across platforms, then ongoing support and updates as the application keeps evolving.' },
      ]},
      { kind: 'prose', head: 'WHO ACTUALLY BUILDS IT', paras: [
        'Projects are led and built by the founder, a senior engineer and designer, so you talk directly to the person who both plans and builds, with no middlemen. For larger projects a carefully selected professional team works under her lead and supervision.',
        'Behind that is more than a decade of real-time 3D across XR, medical technology, gaming, and defense, including commercial products that served millions of users.',
      ]},
      { kind: 'prose', head: 'HOW A PROJECT STARTS', paras: [
        'We start with a short call to understand what you need, then give a clear, transparent estimate before we begin. You can start small, with a pilot or a prototype, and grow from there. A focused module can launch within weeks; a larger system takes longer, with goals and milestones set up front.',
      ]},
      { kind: 'related', head: 'SELECTED WORK', items: ['enzymatic-lab-ar', 'fugacity-vr-lab', 'livemol-research-tool'] },
    ],
    cta: { h: 'Know what you want built?', p: 'Even an initial idea is a good place to start.' },
  },
];

const WORK = [
  {
    slug: 'enzymatic-lab-ar',
    nav: 'Enzymatic Lab AR',
    title: 'Enzymatic Lab AR Model for Meta Quest 3 | Red Crown Interactive',
    desc: 'A mixed reality learning module built for the Wolfson Faculty of Chemical Engineering at the Technion: the molecular world placed on the student’s real desk, with hand tracking and a bilingual robot instructor.',
    h1: ['Enzymatic Lab ', 'Educational Model'],
    sub: 'Mixed Reality · Hand Tracking · Virtual Instructor · Meta Quest 3',
    image: { src: 'assets/work-ar-enzymatic.jpg', alt: 'The enzyme model anchored to a real lab bench in passthrough, with Robi the virtual instructor alongside it' },
    lead: 'A complementary Meta Quest 3 model used to explain theoretical material in greater depth as part of an enzymatic laboratory experiment at the Technion.',
    story: [
      ['The challenge', 'In the biochemistry lab, students run a batch enzyme reactor experiment but never see the molecular world driving it. The enzyme stays invisible, chirality is taught from flat diagrams, and the polarimeter reading changes without a clear reason why. It all stays abstract.'],
      ['The solution', 'We built an augmented reality learning module for Meta Quest 3 that places the molecular world right on the student’s real desk, with no controllers and no prior experience needed. Robi, a friendly bilingual robot instructor, guides students as they compare molecules by hand, rotate the enzyme, watch the reaction unfold step by step, and even fire polarized light at molecules to see how structure shapes the result. Students stay seated at their own desk and see the real room around them the whole time, which keeps motion sickness to a minimum and lets students who normally avoid headsets take part.'],
      ['The result', 'What was invisible at the bench becomes tangible, every concept is built through doing and deciding, and connects directly to the data students measure. Instructors control the pace live and get real-time comprehension feedback. Built and in use at the Wolfson Faculty of Chemical Engineering, Technion.'],
    ],
    facts: [['Platform', 'Meta Quest 3, mixed reality passthrough'], ['Interaction', 'Hand tracking, no controllers'], ['Built with', 'Unity'], ['In use at', 'Wolfson Faculty of Chemical Engineering, Technion']],
    service: 'ar-mr-development',
  },
  {
    slug: 'fugacity-vr-lab',
    nav: 'Fugacity VR Lab',
    title: 'Fugacity VR Experiment for a Full Class | Red Crown Interactive',
    desc: 'An hour-long virtual reality thermodynamics experiment running on up to 12 Meta Quest 3 headsets at once, in use in the Thermodynamics B course at the Technion.',
    h1: ['Immersive Fugacity ', 'VR Experiment'],
    sub: 'Virtual Reality · Hand Gestures · Controllers · Meta Quest 3',
    image: { src: 'assets/work-vr-fugacity.jpg', alt: 'The virtual fugacity apparatus with its pressure gauge, valves and live experiment data panel' },
    lead: 'An hour-long virtual reality experiment that teaches an abstract thermodynamic concept to a whole class at once, consistently and safely.',
    story: [
      ['The challenge', 'How do you teach an abstract thermodynamic concept like fugacity to a whole class at once, consistently and safely, without each student getting a different experience?'],
      ['The solution', 'An hour-long virtual reality experiment where students operate the lab equipment themselves, heating the material, moving the piston, opening valves, and reading the pressure, guided by a virtual instructor. Up to 12 devices run in parallel, each paired with the instructor’s tablet. Movement inside the experiment is deliberately designed to keep motion sickness to a minimum, so a full hour in the headset stays comfortable for an entire class.'],
      ['The result', 'The whole class goes through the same precise, safe experience together, instructors see exactly where each group is and collect the session data, and an abstract concept becomes a tangible, guided experiment. In use in the Thermodynamics B course at the Technion.'],
    ],
    facts: [['Platform', 'Meta Quest 3'], ['Scale', 'Up to 12 headsets in parallel'], ['Session', 'Around one hour, guided'], ['In use at', 'Thermodynamics B, Technion']],
    service: 'vr-development',
  },
  {
    slug: 'livemol-research-tool',
    nav: 'LiveMol Research Tool',
    title: 'LiveMol: Interactive Molecular Research Tool | Red Crown Interactive',
    desc: 'A desktop research tool where scientists build and edit molecules and a machine-learning model returns the calculation onto the structure in front of them, built for the Technion.',
    h1: ['Molecular Scientific ', 'ML Research Tool'],
    sub: 'PC · Machine Learning · Python Server · Real-time 3D',
    image: { src: 'assets/work-ml-livemol.jpg', alt: 'The LiveMol interface with a molecule under analysis, force vectors, and the calculation job panel' },
    lead: 'An interactive 3D tool that keeps a researcher in the loop, instead of waiting for one calculation at a time.',
    story: [
      ['The challenge', 'Researchers needed to build and modify molecular structures and see results immediately, instead of waiting for one calculation at a time and guessing what would change.'],
      ['The solution', 'We built an interactive 3D tool where the researcher builds and edits a molecule, and a machine-learning model runs a scientific calculation on it quickly and returns the result onto the model in front of them, without leaving the flow.'],
      ['The result', 'Research becomes fast, visual, and intuitive, and the machine-learning model enables calculations far faster than the traditional approach. Built for the Wolfson Faculty of Chemical Engineering at the Technion.'],
    ],
    facts: [['Platform', 'Desktop'], ['Behind it', 'Python service, machine-learning model'], ['Built with', 'Unity'], ['Built for', 'Wolfson Faculty of Chemical Engineering, Technion']],
    service: 'scientific-visualization',
  },
  {
    slug: 'meta-quest-classroom',
    nav: 'Meta Quest Classroom',
    title: 'Meta Quest Classroom Setup for a University | Red Crown Interactive',
    desc: 'A physical VR classroom set up end to end at the Technion: up to 12 Meta Quest 3 headsets with paired tablets, installed, tested, and handed over with instructor workflows.',
    h1: ['Physical Meta Quest ', 'Classroom Setup'],
    sub: 'Multi-User VR · Meta Quest 3 · Instructor Tools',
    image: { src: 'assets/work-class-setup.jpg', alt: 'A university classroom with students seated in Meta Quest 3 headsets around lab benches' },
    lead: 'A classroom that runs immersive virtual reality for many groups at once, reliably, week after week.',
    story: [
      ['The challenge', 'The Technion wanted a classroom that runs immersive virtual reality for many groups at once, reliably, without staff losing every lesson to technical issues.'],
      ['The solution', 'We set up the classroom end to end, from hardware selection and space planning to installation, testing, and the instructors’ workflows. Up to 12 Meta Quest 3 headsets, each with a paired tablet.'],
      ['The result', 'A classroom that simply works, where instructors follow each group, support students, and collect data every session. The technology stays in the background, and teaching stays center stage.'],
    ],
    facts: [['Scale', 'Up to 12 headsets with paired tablets'], ['Scope', 'Hardware selection through installation and handover'], ['Includes', 'Instructor workflows and testing'], ['Location', 'Technion']],
    service: 'vr-development',
  },
];

module.exports = { SERVICES, WORK };
