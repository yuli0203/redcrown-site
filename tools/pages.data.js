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
    title: 'AR/VR Development, 3D Art & Product Design | Red Crown Interactive',
    desc: 'End-to-end product design and Unity development: AR/VR immersive experiences, high-end 3D art and animation, and mobile and desktop apps from an Israeli studio.',
    h1: ['Design and development for ', 'immersive experiences'],
    lead: 'Red Crown Interactive brings design and technology together: concept, UI/UX, 3D art and Unity development for businesses, startups and research organizations. We build immersive experiences, interactive simulations, and mobile and desktop products from idea to deployment.',
    serviceType: ['Augmented Reality Development', 'Virtual Reality Development', 'Mixed Reality Development', 'Unity 3D Development', 'End-to-End Product Design', '3D Art & Animation', 'Mobile App Development', 'Desktop App Development'],
    blocks: [
      { kind: 'cards', head: 'THREE PLATFORMS, ONE STUDIO', items: [
        { h: 'XR / VR / AR', p: "Custom VR, AR and MR experiences for a wide range of virtual and augmented reality headsets. We combine 3D design with natural interactions through controllers or hand tracking to create immersive experiences and interactive products." },
        { h: 'Mobile', p: "Custom iOS and Android apps, drawing on the founder’s experience with products that served millions of users. We also build mobile AR experiences with ARKit, ARCore and Unity AR Foundation." },
        { h: 'PC', p: "Custom applications for PCs and workstations: interactive systems, simulations and 3D tools. We bring user interfaces, data and complex calculations together in one clear, easy-to-use product." },
      ]},
      { kind: 'service-details', head: 'VR, AR &amp; MIXED REALITY DEVELOPMENT', items: [
        { id: 'vr-development', h: 'Virtual Reality (VR) Development', p: 'We develop virtual environments and interactive products for a wide range of VR headsets, combining 3D art, controller input and hand interactions. Training simulations are one application of this work: our Fugacity VR experiment at the Technion uses Meta Quest 3, guided practical tasks, teleportation and dedicated navigation controls designed to reduce unnecessary movement.', href: '/work/fugacity-vr-lab/', link: 'Explore the Technion VR case study' },
        { id: 'ar-mr-development', h: 'Augmented Reality (AR) & Mixed Reality (MR) Development', p: 'We build AR and MR experiences that bring interactive 3D content into the real environment. Our headset work includes passthrough on Meta Quest 3, where users see the physical room while handling virtual objects through physics-based hand interactions. The enzymatic lab project developed at the Technion places scientific models on a real table. Our broader AR experience also includes mobile development with ARKit, ARCore and Unity AR Foundation.', href: '/work/enzymatic-lab-ar/', link: 'Explore the Technion AR case study' },
      ]},
      { kind: 'cards', head: 'END-TO-END PRODUCT DESIGN', items: [
        { h: 'Concept & UI/UX Design', p: 'We shape the concept, user journey and visual language together with the technical plan. For AR/VR, interface design includes the surrounding 3D space, how people reach and handle objects, and how guidance supports the task.' },
        { h: '3D Asset Creation', p: 'We create high-end 3D models, animation and visual effects in the studio, integrating the artwork into the working product. The enzyme model and Robi instructor shown in our portfolio are examples of our in-house 3D work.' },
        { h: 'Immersive Experiences', p: 'Design and code work together in Unity: hand tracking, physics-based object interaction and controller input chosen for the experience. We balance visual clarity, comfort and the demands of the target device.' },
      ]},
      { kind: 'chips', head: 'WHAT WE ACTUALLY DO', note: 'Led hands-on by the founder, a senior engineer and designer. For larger work, a selected team operates under her lead.', items: [
        { icon: 'bulb',   t: 'Concept & design' },
        { icon: 'gear',   t: 'Development' },
        { icon: 'cube',   t: '3D Art & Animation' },
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
    cta: { h: 'Have an app, immersive experience or simulation in mind?', p: 'Tell us what you want to build, even if it is still a rough idea.' },
  },
];

const WORK = [
  {
    slug: 'enzymatic-lab-ar',
    client: { name: 'Dana Research Group', url: 'https://dana.net.technion.ac.il/' },
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
    serviceIntro: 'This project showcases our capabilities as an Augmented Reality (AR) development company, combining interactive 3D design and natural hand interactions to build custom Mixed Reality (MR) solutions for education, industry and enterprise.',
    serviceAnchor: 'ar-mr-development',
    story: [
      ['The challenge', 'In the biochemistry lab, students run a batch enzyme reactor experiment but never see the molecular world driving it. The enzyme stays invisible, chirality is taught from flat diagrams, and the polarimeter reading changes without a clear reason why. It all stays abstract.'],
      ['The solution', 'We built an augmented reality learning module for Meta Quest 3 that places the molecular world right on the student’s real desk, with no controllers and no prior experience needed. Robi, a friendly bilingual robot instructor, guides students as they compare molecules by hand, rotate the enzyme, watch the reaction unfold step by step, and even fire polarized light at molecules to see how structure shapes the result. Students stay seated at their own desk and see the real room around them the whole time, which keeps motion sickness to a minimum.'],
      ['The Design & Optimization', 'The in-house 3D model is placed on a real table, keeping the physical room visible and reducing the need for artificial movement. Physics-based hand interactions let students pick up molecules, rotate models and zoom in on scientific structures. We used polygon count reduction, baked lighting and reduced draw calls to lower geometry complexity and real-time rendering work, alongside gesture tuning to refine how hand input controls the virtual objects. The design brings 3D art, spatial orientation and interaction together on Meta Quest 3.'],
      ['The result', 'What was invisible at the bench becomes tangible. Students move inside structures they could never see, handle them with their own hands, and build every concept by doing and deciding rather than by reading a flat diagram. Built and in use at the Wolfson Faculty of Chemical Engineering, Technion.'],
    ],
    facts: [['Platform', 'Meta Quest 3, mixed reality passthrough'], ['Interaction', 'Hand tracking, no controllers'], ['Built with', 'Unity'], ['In use at', 'Wolfson Faculty of Chemical Engineering, Technion']],
    service: '',
  },
  {
    slug: 'fugacity-vr-lab',
    client: { name: 'Dana Research Group', url: 'https://dana.net.technion.ac.il/' },
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
      ['The Design & Optimization', 'The VR experience uses teleportation and dedicated navigation controls designed to reduce unnecessary movement and minimize motion sickness during an approximately one-hour session. Robi, our in-house 3D virtual instructor, provides spoken guidance. Polygon count reduction, baked lighting and reduced draw calls lower geometry complexity and real-time rendering work, while gesture tuning refines hand-based actions alongside controller input on Meta Quest 3.'],
      ['The result', 'The whole class goes through the same precise, safe experience together, instructors see exactly where each group is and collect the session data, and an abstract concept becomes a tangible, guided experiment. In use in the Thermodynamics B course at the Technion.'],
    ],
    facts: [['Platform', 'Meta Quest 3'], ['Scale', 'Up to 12 headsets in parallel'], ['Session', 'Around one hour, guided'], ['In use at', 'Thermodynamics B, Technion']],
    service: '',
  },
  {
    slug: 'livemol-research-tool',
    client: { name: 'Dana Research Group', url: 'https://dana.net.technion.ac.il/' },
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
      ['The Design & Optimization', 'The Unity client keeps molecular editing and real-time 3D visualization in one interface, while a separate Python compute server handles the heavy quantum chemistry calculations. This separation keeps the interface responsive as computation runs, and returns results onto the structure the researcher is already working with. The platform is in development for PC; AR is a later-stage direction.'],
      ['The result', 'Research becomes fast, visual, and intuitive, and the researcher stays inside the structure while the calculation runs, instead of waiting on one job at a time. Built for the Wolfson Faculty of Chemical Engineering at the Technion.'],
    ],
    facts: [['Platform', 'Desktop'], ['Behind it', 'Python compute server, quantum chemistry engines (ASE, tblite, Open Babel, Sella)'], ['Built with', 'Unity'], ['Built for', 'Wolfson Faculty of Chemical Engineering, Technion']],
    service: '',
  },
  {
    slug: 'meta-quest-classroom',
    client: { name: 'Dana Research Group', url: 'https://dana.net.technion.ac.il/' },
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
      ['The Design & Optimization', 'The classroom layout provides dedicated seating and sufficient interaction space, with charging, storage and instructor supervision planned together. Paired tablets make group progress and session data accessible to instructors. Network readiness, application distribution and operational procedures were considered alongside testing under realistic multi-user conditions; this project concerns deployment and workflow rather than 3D graphics optimization.'],
      ['The result', 'A classroom that simply works, where instructors follow each group, support students, and collect data every session. The technology stays in the background, and teaching stays center stage.'],
    ],
    facts: [['Scale', 'Up to 12 headsets with paired tablets'], ['Scope', 'Advisory, from hardware selection through handover'], ['Includes', 'Instructor workflows and testing'], ['Location', 'Technion']],
    service: '',
  },
];

module.exports = { SERVICES, WORK };
