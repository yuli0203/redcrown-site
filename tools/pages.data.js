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
    slug: '',                       // lives at /services/ rather than a sub-path
    nav: 'Services',
    title: 'Unity Development for XR, Mobile & PC | Red Crown Interactive',
    desc: 'One studio for interactive software across XR, mobile and desktop: guided VR experiments, mixed reality on the real bench, and research tools, built in Unity from concept to deployment.',
    h1: ['Interactive software for ', 'science and engineering'],
    lead: 'We build software that turns complex scientific and engineering work into something people can see and handle, across headsets, phones and desktops, and we take it from concept through to a system that runs every week.',
    serviceType: 'Interactive software development',
    blocks: [
      { kind: 'cards', head: 'THREE PLATFORMS, ONE STUDIO', items: [
        { h: 'XR / VR / AR', p: 'Simulations, labs and training in VR, AR and mixed reality, with hand, gesture and controller interaction chosen to fit the task. Built on Meta Quest 3.' },
        { h: 'Mobile', p: 'iOS and Android apps and companion AR tools for work that happens in the field, drawing on commercial products that served millions of users.' },
        { h: 'PC', p: 'Complex real-time systems: research tools, simulations and high-performance 3D software, with scientific computing and machine learning behind them.' },
      ]},
      { kind: 'chips', head: 'WHAT WE ACTUALLY DO', note: 'Led hands-on by the founder, a senior engineer and designer. For larger work, a selected team operates under her lead.', items: [
        { icon: 'bulb',   t: 'Concept & design' },
        { icon: 'gear',   t: 'Development' },
        { icon: 'cube',   t: '3D art & animation' },
        { icon: 'gauge',  t: 'Optimisation' },
        { icon: 'wrench', t: 'Support & updates' },
      ]},
      { kind: 'icons', head: 'TOOLS WE BUILD WITH', icons: [
        ['unity','Unity'],['csharp','C#'],['cplusplus','C++'],['python','Python'],
        ['oculus','Meta Quest'],['ios','iOS'],['android','Android'],['webgl','WebGL'],['blender','Blender'],
      ]},
      { kind: 'tiles', head: 'BUILT FOR A REAL TIMETABLE', items: [
        ['Comfort', 'A full hour in the headset'],
        ['Scale', 'A whole cohort at once'],
        ['Instructors', 'See where every group is'],
        ['Between classes', 'Charging, reset, recovery'],
      ]},
      { kind: 'process', head: 'HOW A PROJECT RUNS', tracks: [
        { name: 'Focused module or pilot',
          note: 'One experiment, one procedure, one tool. Launches in weeks.',
          steps: [
            { t: 'Introductory call',      d: '30 minutes', p: 'What you teach or build, what is not working, and whether this is even the right tool.' },
            { t: 'Scoping session',        d: '1 to 2 hours', p: 'We go through the material together and agree what the module has to do.' },
            { t: 'Written proposal',       d: 'Within days', p: 'Scope, milestones and a clear price, before any work begins.' },
            { t: 'Build',                  d: 'Weeks', p: 'Development, 3D and interaction, with checkpoints you can steer from.' },
            { t: 'QA on real devices',     d: 'Before handover', p: 'Tested on the headsets and phones it will actually run on, not just in the editor.' },
            { t: 'Handover and support',   d: 'Ongoing', p: 'Installed where it runs, with the people who will use it shown how.' },
          ] },
        { name: 'Larger system',
          note: 'A course, a classroom, or a platform. Built in milestones with a team.',
          steps: [
            { t: 'Introductory call',      d: '30 minutes', p: 'The same starting point: what you need and whether we are the right studio for it.' },
            { t: 'Scoping workshop',       d: 'Half a day', p: 'With your teaching or engineering staff, so the requirements come from the people who will live with it.' },
            { t: 'Technical plan',         d: '1 to 2 weeks', p: 'Architecture, platform choices, milestones and budget, written down before commitment.' },
            { t: 'Team assembly',          d: 'Selected per project', p: 'Development, 3D and design specialists brought in and managed under the founder, who stays hands-on.' },
            { t: 'Build in milestones',    d: 'Months', p: 'Each milestone is something you can put in front of real users, not a status report.' },
            { t: 'QA on real devices',     d: 'Every milestone', p: 'Multi-device and multi-user testing, because a class of twelve fails differently from one headset.' },
            { t: 'Deployment on site',     d: 'On your premises', p: 'Hardware, installation and the instructor workflows around it.' },
            { t: 'Handover and support',   d: 'Ongoing', p: 'Training, documentation and updates as the system keeps evolving.' },
          ] },
      ] },
      { kind: 'related', head: 'SELECTED WORK', items: ['enzymatic-lab-ar', 'fugacity-vr-lab', 'livemol-research-tool', 'meta-quest-classroom'] },
    ],
    cta: { h: 'Got a course, a lab, or a procedure to rebuild?', p: 'Tell us what you want to build, even if it is still a rough idea.' },
  },
];

const WORK = [
  {
    slug: 'enzymatic-lab-ar',
    model: { key: 'enzym', alt: 'Interactive 3D enzymatic lab model built for Meta Quest, drag to rotate',
             badge: '◆ Meta Quest 3 · AR',
             hint: 'The actual model from the module. Drag to rotate, use the slider to look inside.' },
    nav: 'Enzymatic Lab AR',
    title: 'Enzymatic Lab AR Model for Meta Quest 3 | Red Crown Interactive',
    desc: 'A mixed reality learning module built for the Wolfson Faculty of Chemical Engineering at the Technion: the molecular world placed on the student’s real desk, with hand tracking and a bilingual robot instructor.',
    h1: ['Enzymatic Lab ', 'Educational Model'],
    sub: 'Mixed Reality · Hand Tracking · Virtual Instructor · Meta Quest 3',
    image: { src: 'assets/work-ar-enzymatic.jpg', alt: 'The enzyme model anchored to a real lab bench in passthrough, with Robi the virtual instructor alongside it' },
    lead: 'A complementary Meta Quest 3 model used to explain theoretical material in greater depth as part of an enzymatic laboratory experiment at the Technion.',
    story: [
      ['The challenge', 'In the biochemistry lab, students run a batch enzyme reactor experiment but never see the molecular world driving it. The enzyme stays invisible, chirality is taught from flat diagrams, and the polarimeter reading changes without a clear reason why. It all stays abstract.'],
      ['The solution', 'We built an augmented reality learning module for Meta Quest 3 that places the molecular world right on the student’s real desk, with no controllers and no prior experience needed. Robi, a friendly bilingual robot instructor, guides students as they compare molecules by hand, rotate the enzyme, watch the reaction unfold step by step, and even fire polarized light at molecules to see how structure shapes the result. Students stay seated at their own desk and see the real room around them the whole time, which keeps motion sickness to a minimum.'],
      ['The result', 'What was invisible at the bench becomes tangible. Students move inside structures they could never see, handle them with their own hands, and build every concept by doing and deciding rather than by reading a flat diagram. Built and in use at the Wolfson Faculty of Chemical Engineering, Technion.'],
    ],
    facts: [['Platform', 'Meta Quest 3, mixed reality passthrough'], ['Interaction', 'Hand tracking, no controllers'], ['Built with', 'Unity'], ['In use at', 'Wolfson Faculty of Chemical Engineering, Technion']],
    service: '',
  },
  {
    slug: 'fugacity-vr-lab',
    model: { key: 'robi', alt: 'Robi, our in-house VR instructor, drag to rotate',
             badge: '◆ Robi · our VR instructor',
             hint: 'Robi, the instructor who guides students through the experiment. Drag to rotate.' },
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
    service: '',
  },
  {
    slug: 'livemol-research-tool',
    model: { key: 'caffeine', alt: 'Interactive 3D molecule built in LiveMol, drag to rotate',
             badge: '◆ Built in LiveMol',
             hint: 'A molecule generated by LiveMol itself. Drag to rotate, use the slider to zoom in.' },
    nav: 'LiveMol Research Tool',
    title: 'LiveMol: Interactive Molecular Research Tool | Red Crown Interactive',
    desc: 'A desktop research tool where scientists build and edit molecules and a Python compute server returns the quantum chemistry calculation onto the structure in front of them, built for the Technion.',
    h1: ['Molecular Scientific ', 'ML Research Tool'],
    sub: 'PC · Machine Learning · Python Server · Real-time 3D',
    image: { src: 'assets/work-ml-livemol.jpg', alt: 'The LiveMol interface with a molecule under analysis, force vectors, and the calculation job panel' },
    lead: 'An interactive 3D tool that keeps a researcher in the loop, instead of waiting for one calculation at a time.',
    story: [
      ['The challenge', 'Researchers needed to build and modify molecular structures and see results immediately, instead of waiting for one calculation at a time and guessing what would change.'],
      ['The solution', 'We built an interactive 3D tool where the researcher builds and edits a molecule, and a Python compute server runs the quantum chemistry calculation, using established engines including ASE, tblite, Open Babel and Sella, and returns the result onto the model in front of them, without leaving the flow.'],
      ['The result', 'Research becomes fast, visual, and intuitive, and the researcher stays inside the structure while the calculation runs, instead of waiting on one job at a time. Built for the Wolfson Faculty of Chemical Engineering at the Technion.'],
    ],
    facts: [['Platform', 'Desktop'], ['Behind it', 'Python compute server, quantum chemistry engines (ASE, tblite, Open Babel, Sella)'], ['Built with', 'Unity'], ['Built for', 'Wolfson Faculty of Chemical Engineering, Technion']],
    service: '',
  },
  {
    slug: 'meta-quest-classroom',
    model: { key: 'quest3', alt: 'Meta Quest 3 headset, drag to rotate',
             badge: '◆ Meta Quest 3',
             hint: 'The headset the classroom runs on. Drag to rotate.' },
    nav: 'Meta Quest Classroom',
    title: 'Meta Quest Classroom Setup for a University | Red Crown Interactive',
    desc: 'A physical VR classroom guided end to end at the Technion: up to 12 Meta Quest 3 headsets with paired tablets, configured, tested, and handed over with instructor workflows.',
    h1: ['Physical Meta Quest ', 'Classroom Setup'],
    sub: 'Multi-User VR · Meta Quest 3 · Instructor Tools',
    image: { src: 'assets/work-class-setup.jpg', alt: 'A university classroom with students seated in Meta Quest 3 headsets around lab benches' },
    lead: 'A classroom that runs immersive virtual reality for many groups at once, reliably, week after week.',
    story: [
      ['The challenge', 'The Technion wanted a classroom that runs immersive virtual reality for many groups at once, reliably, without staff losing every lesson to technical issues.'],
      ['The solution', 'We consulted end to end, from early planning and hardware selection through classroom layout, device configuration, deployment, testing, and the instructors’ workflows. Up to 12 Meta Quest 3 headsets, each with a paired tablet.'],
      ['The result', 'A classroom that simply works, where instructors follow each group, support students, and collect data every session. The technology stays in the background, and teaching stays center stage.'],
    ],
    facts: [['Scale', 'Up to 12 headsets with paired tablets'], ['Scope', 'Advisory, from hardware selection through handover'], ['Includes', 'Instructor workflows and testing'], ['Location', 'Technion']],
    service: '',
  },
];

module.exports = { SERVICES, WORK };
