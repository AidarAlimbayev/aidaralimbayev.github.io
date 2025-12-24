(function () {
  const baseTranslations = {
    en: {
      'nav.brand': 'Aidar Alimbayev',
      'nav.about': 'About',
      'nav.materials': 'Materials Sciecne Research',
      'nav.research': 'Previous Research',
      'nav.social': 'Social Media',
      'nav.contact': 'Contact',
      'nav.cv': 'View CV',
      'hero.badge': 'PhD Student · Machine Learning',
      'hero.name': 'Aidar Alimbayev',
      'hero.lead': 'I am a PhD student in Machine Learning at <a href="https://mbzuai.ac.ae/">Mohamed bin Zayed University of Artificial Intelligence (MBZUAI)</a>, Abu Dhabi, with a research focus on applying machine learning to materials science and quantum-informed modeling. I am a member of the Materials Sciecne Research group under the supervision of <a href="https://mtakac.com/">Prof. Martin Takáč</a> (see his personal page at mtakac.com and the <a href="https://mbzuai.ac.ae/study/faculty/martin-takac/">MBZUAI faculty page</a>).',
      'hero.research': 'Our research explores several physics-informed and data-driven approaches for predicting physical properties of molecules and crystalline materials. Selected demos and examples of our work are available on the <a href="materials.html">Materials Sciecne Research page</a> of this website.',
      'hero.previous': 'Previously, I worked as an engineer at the NURIS Fab Lab, where I mentored students and early-stage startups, supporting the development of hardware and AI-driven prototypes.',
      'hero.visiting': 'I was also a visiting scholar at Texas A&M University, where I developed physics-informed neural networks under the supervision of <a href="https://engineering.tamu.edu/electrical/profiles/ubraganeto.html">Prof. Ulisses Braga-Neto</a>. This research visit was supported by a <a href="https://yessenovfoundation.org/en/eng-aidar-alimbayev/">Shakhmardan Yessenov Foundation Fellowship</a>.',
      'hero.journey': 'My journey into machine learning began with a health data research project supported by Prof. <a href="https://www.linkedin.com/in/aminzollanvari/">Amin Zollanvari</a> and Prof. <a href="https://www.linkedin.com/in/abduzhappar-gaipov-2667b7130/">Abduzhappar Gaipov</a> at the Nazarbayev University School of Medicine (NUSOM). You can read our paper in <a href="https://www.nature.com/articles/s41598-023-35551-4">Nature</a>.',
      'hero.ctaCv': 'Download CV',
      'hero.ctaEmail': 'Email',
      'hero.ctaMaterials': 'Materials Sciecne Research page',
      'hero.interests': 'Interests: rowing, marathon training, and building resilient hardware.',
      'materials.kicker': 'Materials Sciecne Research',
      'materials.title': 'Materials Sciecne Research @ MBZUAI',
      'materials.body': 'Physics-informed and data-driven models for molecules and crystalline materials, with updates, demos, and benchmarks.',
      'materials.ctaPrimary': 'Open Materials Sciecne Research page',
      'materials.ctaSecondary': 'View Google Scholar',
      'materials.focus.title': 'Physics-informed + data-driven',
      'materials.focus.body': 'Hybrid models for property prediction across molecules and crystals, integrating domain priors with graph-based learning.',
      'materials.demos.title': 'Benchmarks and demos',
      'materials.demos.body': 'Follow along for curated datasets, baselines, and interactive examples as we release new experiments.',
      'materials.upcoming.title': 'Upcoming demos',
      'materials.upcoming.body': 'Interactive examples, baselines, and datasets as experiments mature. Collaborators welcome.',
      'materials.ctaScholar': 'View Google Scholar',
      'research.kicker': 'Previous Research',
      'research.title': 'Previous Research',
      'research.test.title': 'Test Stand for Prospective Mobile Power-Supply Sources',
      'research.test.authors': 'IEEE publication · A. S. Alimbaev, V. S. Uss, A. B. Mirmanov, P. P. Shumakov',
      'research.test.link': 'Paper PDF',
      'research.test.desc': 'Demonstrated long-term testing of storage batteries and ionistors using NI DAQ hardware and LabVIEW, capturing degradation trends under continuous cycling.',
      'research.ppm.title': 'Implementation of PPM Modulation and Demodulation using NI FPGA Board',
      'research.ppm.authors': 'Conference paper · A. S. Alimbaev et al.',
      'research.ppm.link': 'Paper PDF',
      'research.ppm.desc': 'Built a pulse-position modulation workflow with FPGA-based processing blocks and validated demodulation fidelity across channel conditions.',
      'research.swarm.title': 'Swarm Intelligence Experiments for Control',
      'research.swarm.authors': 'Ongoing study · Simulation toolkit',
      'research.swarm.link': 'View demo',
      'research.swarm.desc': 'Investigating convergence dynamics of particle swarm optimization with visual tooling for teaching and rapid experimentation.',
      'more.kicker': 'Explore',
      'more.title': 'More from Aidar',
      'more.primary': 'Materials Sciecne Research page',
      'more.materials.title': 'Materials Sciecne Research',
      'more.materials.desc': 'Stay close to the main project with updates, datasets, and demos from our materials ML work.',
      'more.materials.link': 'Visit page →',
      'more.social.title': 'Social Media',
      'more.social.desc': 'TV, news, and foundation spotlights gathered from recent coverage.',
      'more.social.link': 'See mentions →',
      'more.scholar.title': 'Google Scholar',
      'more.scholar.desc': 'Full list of papers, co-authors, and citation stats.',
      'more.scholar.link': 'Open profile →',
      'contact.kicker': 'Contact',
      'contact.title': "Let's connect",
      'contact.body': 'Use the form below or email me at <a class="underline" href="mailto:aidar.alimbayev@mbzuai.ac.ae">aidar.alimbayev@mbzuai.ac.ae</a>.',
      'contact.name': 'Name',
      'contact.email': 'Email',
      'contact.message': 'Message',
      'contact.submit': 'Send message',
      'contact.sending': 'Sending...',
      'footer.role': 'AI researcher & builder.'
    },
    kk: {
      'nav.brand': 'Aidar Alimbayev',
      'nav.about': 'Мен туралы',
      'nav.materials': 'Materials Sciecne Research',
      'nav.research': 'Previous Research',
      'nav.social': 'Әлеуметтік медиа',
      'nav.contact': 'Байланыс',
      'nav.cv': 'CV жүктеу',
      'hero.badge': 'PhD студенті · Машина оқыту',
      'hero.name': 'Aidar Alimbayev',
      'hero.lead': 'I am a PhD student in Machine Learning at <a href="https://mbzuai.ac.ae/">Mohamed bin Zayed University of Artificial Intelligence (MBZUAI)</a>, Abu Dhabi, with a research focus on applying machine learning to materials science and quantum-informed modeling. I am a member of the Materials Sciecne Research group under the supervision of <a href="https://mtakac.com/">Prof. Martin Takáč</a> (see his personal page at mtakac.com and the <a href="https://mbzuai.ac.ae/study/faculty/martin-takac/">MBZUAI faculty page</a>).',
      'hero.research': 'Our research explores several physics-informed and data-driven approaches for predicting physical properties of molecules and crystalline materials. Selected demos and examples of our work are available on the <a href="materials.html">Materials Sciecne Research page</a> of this website.',
      'hero.previous': 'Previously, I worked as an engineer at the NURIS Fab Lab, where I mentored students and early-stage startups, supporting the development of hardware and AI-driven prototypes.',
      'hero.visiting': 'I was also a visiting scholar at Texas A&M University, where I developed physics-informed neural networks under the supervision of <a href="https://engineering.tamu.edu/electrical/profiles/ubraganeto.html">Prof. Ulisses Braga-Neto</a>. This research visit was supported by a <a href="https://yessenovfoundation.org/en/eng-aidar-alimbayev/">Shakhmardan Yessenov Foundation Fellowship</a>.',
      'hero.ctaCv': 'CV жүктеу',
      'hero.ctaEmail': 'Эл. пошта',
      'hero.ctaMaterials': 'Materials Sciecne Research page',
      'hero.interests': 'Қызығушылықтар: есу, марафонға дайындық және сенімді құрылғылар құру.',
      'materials.kicker': 'Материалдар ғылымы',
      'materials.title': 'Materials Sciecne Research @ MBZUAI',
      'materials.body': 'Physics-informed and data-driven models for molecules and crystalline materials, with updates, demos, and benchmarks.',
      'materials.ctaPrimary': 'Open Materials Sciecne Research page',
      'materials.ctaSecondary': 'View Google Scholar',
      'materials.focus.title': 'Physics-informed + data-driven',
      'materials.focus.body': 'Hybrid models for property prediction across molecules and crystals, integrating domain priors with graph-based learning.',
      'materials.demos.title': 'Benchmarks and demos',
      'materials.demos.body': 'Follow along for curated datasets, baselines, and interactive examples as we release new experiments.',
      'materials.upcoming.title': 'Upcoming demos',
      'materials.upcoming.body': 'Interactive examples, baselines, and datasets as experiments mature. Collaborators welcome.',
      'materials.ctaScholar': 'View Google Scholar',
      'research.kicker': 'Previous Research',
      'research.title': 'Негізгі мақалалар',
      'research.test.title': 'Перспективалық мобильді қорек көздеріне арналған сынақ стенді',
      'research.test.authors': 'IEEE жарияланымы · A. S. Alimbaev және әріптестер',
      'research.test.link': 'Мақала PDF',
      'research.test.desc': 'DAQ және LabVIEW арқылы батареяларды ұзақ мерзімді сынау және деградацияны бақылау.',
      'research.ppm.title': 'NI FPGA платасында PPM модуляциясы мен демодуляциясы',
      'research.ppm.authors': 'Конференция мақаласы · A. S. Alimbaev және әріптестер',
      'research.ppm.link': 'Мақала PDF',
      'research.ppm.desc': 'Арна жағдайларының түрлі нұсқаларында демодуляция дәлдігін тексердім.',
      'research.swarm.title': 'Бақылау үшін рой интеллекті тәжірибелері',
      'research.swarm.authors': 'Жүріп жатқан зерттеу · Симуляция құралдары',
      'research.swarm.link': 'Демо көру',
      'research.swarm.desc': 'Рой алгоритмдерінің жинақталуын визуализациялау және оқытуға арналған құрал.',
      'more.kicker': 'Қосымша',
      'more.title': 'Aidar туралы көбірек',
      'more.primary': 'Materials Sciecne Research page',
      'more.materials.title': 'Материалдар ғылымы',
      'more.materials.desc': 'Негізгі жобам бойынша жаңартулар, деректер және демолар.',
      'more.materials.link': 'Бетті ашу →',
      'more.social.title': 'Әлеуметтік медиа',
      'more.social.desc': 'ТВ, жаңалықтар және қор жарияланымдары.',
      'more.social.link': 'Материалдар →',
      'more.scholar.title': 'Google Scholar',
      'more.scholar.desc': 'Мақалалар тізімі және авторлар.',
      'more.scholar.link': 'Профиль →',
      'contact.kicker': 'Байланыс',
      'contact.title': 'Хабарласыңыз',
      'contact.body': 'Форманы толтырыңыз немесе <a class="underline" href="mailto:aidar.alimbayev@mbzuai.ac.ae">aidar.alimbayev@mbzuai.ac.ae</a> поштасына жазыңыз.',
      'contact.name': 'Аты',
      'contact.email': 'Эл. пошта',
      'contact.message': 'Хабарлама',
      'contact.submit': 'Жіберу',
      'contact.sending': 'Жіберілуде...',
      'footer.role': 'AI зерттеушісі және құрастырушы.'
    },
    ru: {
      'nav.brand': 'Aidar Alimbayev',
      'nav.about': 'Обо мне',
      'nav.materials': 'Materials Sciecne Research',
      'nav.research': 'Previous Research',
      'nav.social': 'Соцсети',
      'nav.contact': 'Контакты',
      'nav.cv': 'Скачать CV',
      'hero.badge': 'Студент PhD · Машинное обучение',
      'hero.name': 'Aidar Alimbayev',
      'hero.lead': 'I am a PhD student in Machine Learning at <a href="https://mbzuai.ac.ae/">Mohamed bin Zayed University of Artificial Intelligence (MBZUAI)</a>, Abu Dhabi, with a research focus on applying machine learning to materials science and quantum-informed modeling. I am a member of the Materials Sciecne Research group under the supervision of <a href="https://mtakac.com/">Prof. Martin Takáč</a> (see his personal page at mtakac.com and the <a href="https://mbzuai.ac.ae/study/faculty/martin-takac/">MBZUAI faculty page</a>).',
      'hero.research': 'Our research explores several physics-informed and data-driven approaches for predicting physical properties of molecules and crystalline materials. Selected demos and examples of our work are available on the <a href="materials.html">Materials Sciecne Research page</a> of this website.',
      'hero.previous': 'Previously, I worked as an engineer at the NURIS Fab Lab, where I mentored students and early-stage startups, supporting the development of hardware and AI-driven prototypes.',
      'hero.visiting': 'I was also a visiting scholar at Texas A&M University, where I developed physics-informed neural networks under the supervision of <a href="https://engineering.tamu.edu/electrical/profiles/ubraganeto.html">Prof. Ulisses Braga-Neto</a>. This research visit was supported by a <a href="https://yessenovfoundation.org/en/eng-aidar-alimbayev/">Shakhmardan Yessenov Foundation Fellowship</a>.',
      'hero.ctaCv': 'Скачать CV',
      'hero.ctaEmail': 'Почта',
      'hero.ctaMaterials': 'Materials Sciecne Research page',
      'hero.interests': 'Интересы: гребля, марафон, надежные аппаратные решения.',
      'materials.kicker': 'Материаловедение',
      'materials.title': 'Materials Sciecne Research @ MBZUAI',
      'materials.body': 'Physics-informed and data-driven models for molecules and crystalline materials, with updates, demos, and benchmarks.',
      'materials.ctaPrimary': 'Open Materials Sciecne Research page',
      'materials.ctaSecondary': 'View Google Scholar',
      'materials.focus.title': 'Physics-informed + data-driven',
      'materials.focus.body': 'Hybrid models for property prediction across molecules and crystals, integrating domain priors with graph-based learning.',
      'materials.demos.title': 'Benchmarks and demos',
      'materials.demos.body': 'Follow along for curated datasets, baselines, and interactive examples as we release new experiments.',
      'materials.upcoming.title': 'Upcoming demos',
      'materials.upcoming.body': 'Interactive examples, baselines, and datasets as experiments mature. Collaborators welcome.',
      'materials.ctaScholar': 'View Google Scholar',
      'research.kicker': 'Previous Research',
      'research.title': 'Избранные статьи',
      'research.test.title': 'Стенд для перспективных мобильных источников питания',
      'research.test.authors': 'IEEE публикация · A. S. Alimbaev и коллеги',
      'research.test.link': 'PDF статьи',
      'research.test.desc': 'Долговременные испытания батарей на DAQ и LabVIEW, отслеживание деградации.',
      'research.ppm.title': 'PPM модуляция и демодуляция на NI FPGA',
      'research.ppm.authors': 'Конференция · A. S. Alimbaev и коллеги',
      'research.ppm.link': 'PDF статьи',
      'research.ppm.desc': 'Проверка точности демодуляции при разных условиях канала.',
      'research.swarm.title': 'Эксперименты с роевым интеллектом',
      'research.swarm.authors': 'Продолжается · Симулятор',
      'research.swarm.link': 'Демо',
      'research.swarm.desc': 'Визуализация сходимости алгоритмов роя для обучения.',
      'more.kicker': 'Дополнительно',
      'more.title': 'Больше об Aidar',
      'more.primary': 'Materials Sciecne Research page',
      'more.materials.title': 'Материаловедение',
      'more.materials.desc': 'Обновления, датасеты и демо по основному проекту.',
      'more.materials.link': 'Перейти →',
      'more.social.title': 'Соцсети',
      'more.social.desc': 'Телевидение, СМИ и фонды.',
      'more.social.link': 'Перейти →',
      'more.scholar.title': 'Google Scholar',
      'more.scholar.desc': 'Все статьи, соавторы и статистика цитирования.',
      'more.scholar.link': 'Профиль →',
      'contact.kicker': 'Контакты',
      'contact.title': 'Давайте свяжемся',
      'contact.body': 'Заполните форму или напишите на <a class="underline" href="mailto:aidar.alimbayev@mbzuai.ac.ae">aidar.alimbayev@mbzuai.ac.ae</a>.',
      'contact.name': 'Имя',
      'contact.email': 'Почта',
      'contact.message': 'Сообщение',
      'contact.submit': 'Отправить',
      'contact.sending': 'Отправляется...',
      'footer.role': 'Исследователь и практик AI.'
    },
    ar: {
      'nav.brand': 'Aidar Alimbayev',
      'nav.about': 'من أنا',
      'nav.materials': 'Materials Sciecne Research',
      'nav.research': 'Previous Research',
      'nav.social': 'وسائل التواصل',
      'nav.contact': 'تواصل',
      'nav.cv': 'تنزيل السيرة',
      'hero.badge': 'طالب دكتوراه · تعلم آلي',
      'hero.name': 'Aidar Alimbayev',
      'hero.lead': 'I am a PhD student in Machine Learning at <a href="https://mbzuai.ac.ae/">Mohamed bin Zayed University of Artificial Intelligence (MBZUAI)</a>, Abu Dhabi, with a research focus on applying machine learning to materials science and quantum-informed modeling. I am a member of the Materials Sciecne Research group under the supervision of <a href="https://mtakac.com/">Prof. Martin Takáč</a> (see his personal page at mtakac.com and the <a href="https://mbzuai.ac.ae/study/faculty/martin-takac/">MBZUAI faculty page</a>).',
      'hero.research': 'Our research explores several physics-informed and data-driven approaches for predicting physical properties of molecules and crystalline materials. Selected demos and examples of our work are available on the <a href="materials.html">Materials Sciecne Research page</a> of this website.',
      'hero.previous': 'Previously, I worked as an engineer at the NURIS Fab Lab, where I mentored students and early-stage startups, supporting the development of hardware and AI-driven prototypes.',
      'hero.visiting': 'I was also a visiting scholar at Texas A&M University, where I developed physics-informed neural networks under the supervision of <a href="https://engineering.tamu.edu/electrical/profiles/ubraganeto.html">Prof. Ulisses Braga-Neto</a>. This research visit was supported by a <a href="https://yessenovfoundation.org/en/eng-aidar-alimbayev/">Shakhmardan Yessenov Foundation Fellowship</a>.',
      'hero.ctaCv': 'تنزيل السيرة',
      'hero.ctaEmail': 'البريد',
      'hero.ctaMaterials': 'Materials Sciecne Research page',
      'hero.interests': 'اهتمامات: التجديف، الماراثون، وبناء أجهزة موثوقة.',
      'materials.kicker': 'علوم المواد',
      'materials.title': 'Materials Sciecne Research @ MBZUAI',
      'materials.body': 'Physics-informed and data-driven models for molecules and crystalline materials, with updates, demos, and benchmarks.',
      'materials.ctaPrimary': 'Open Materials Sciecne Research page',
      'materials.ctaSecondary': 'View Google Scholar',
      'materials.focus.title': 'Physics-informed + data-driven',
      'materials.focus.body': 'Hybrid models for property prediction across molecules and crystals, integrating domain priors with graph-based learning.',
      'materials.demos.title': 'Benchmarks and demos',
      'materials.demos.body': 'Follow along for curated datasets, baselines, and interactive examples as we release new experiments.',
      'materials.upcoming.title': 'Upcoming demos',
      'materials.upcoming.body': 'Interactive examples, baselines, and datasets as experiments mature. Collaborators welcome.',
      'materials.ctaScholar': 'View Google Scholar',
      'research.kicker': 'Previous Research',
      'research.title': 'أوراق مميزة',
      'research.test.title': 'منصة اختبار لمصادر الطاقة المتنقلة الواعدة',
      'research.test.authors': 'منشور IEEE · A. S. Alimbaev وآخرون',
      'research.test.link': 'ملف PDF',
      'research.test.desc': 'اختبارات طويلة الأمد للبطاريات باستخدام DAQ وLabVIEW مع تتبع التدهور.',
      'research.ppm.title': 'تضمين وفك تضمين PPM على NI FPGA',
      'research.ppm.authors': 'ورقة مؤتمر · A. S. Alimbaev وآخرون',
      'research.ppm.link': 'ملف PDF',
      'research.ppm.desc': 'تحقق من دقة فك التضمين في ظروف قناة مختلفة.',
      'research.swarm.title': 'تجارب ذكاء السرب للتحكم',
      'research.swarm.authors': 'عمل جارٍ · مجموعة محاكاة',
      'research.swarm.link': 'عرض demo',
      'research.swarm.desc': 'أدوات مرئية لفهم سلوك تقارب خوارزميات السرب.',
      'more.kicker': 'اكتشف',
      'more.title': 'المزيد من Aidar',
      'more.primary': 'Materials Sciecne Research page',
      'more.materials.title': 'علوم المواد',
      'more.materials.desc': 'تحديثات وبيانات وعروض حول المشروع الرئيسي.',
      'more.materials.link': 'فتح الصفحة →',
      'more.social.title': 'وسائل التواصل',
      'more.social.desc': 'تغطية تلفزيونية وإخبارية ومنح دراسية.',
      'more.social.link': 'عرض الروابط →',
      'more.scholar.title': 'Google Scholar',
      'more.scholar.desc': 'كل الأوراق والتعاونيات وإحصائيات الاقتباس.',
      'more.scholar.link': 'الملف الشخصي →',
      'contact.kicker': 'تواصل',
      'contact.title': 'لنتواصل',
      'contact.body': 'استخدم النموذج أدناه أو راسلني على <a class="underline" href="mailto:aidar.alimbayev@mbzuai.ac.ae">aidar.alimbayev@mbzuai.ac.ae</a>.',
      'contact.name': 'الاسم',
      'contact.email': 'البريد الإلكتروني',
      'contact.message': 'الرسالة',
      'contact.submit': 'إرسال',
      'contact.sending': 'يتم الإرسال...',
      'footer.role': 'باحث ومطور للذكاء الاصطناعي.'
    },
    es: {
      'nav.brand': 'Aidar Alimbayev',
      'nav.about': 'Sobre mí',
      'nav.materials': 'Materials Sciecne Research',
      'nav.research': 'Previous Research',
      'nav.social': 'Redes sociales',
      'nav.contact': 'Contacto',
      'nav.cv': 'Ver CV',
      'hero.badge': 'Estudiante de doctorado · ML',
      'hero.name': 'Aidar Alimbayev',
      'hero.lead': 'I am a PhD student in Machine Learning at <a href="https://mbzuai.ac.ae/">Mohamed bin Zayed University of Artificial Intelligence (MBZUAI)</a>, Abu Dhabi, with a research focus on applying machine learning to materials science and quantum-informed modeling. I am a member of the Materials Sciecne Research group under the supervision of <a href="https://mtakac.com/">Prof. Martin Takáč</a> (see his personal page at mtakac.com and the <a href="https://mbzuai.ac.ae/study/faculty/martin-takac/">MBZUAI faculty page</a>).',
      'hero.research': 'Our research explores several physics-informed and data-driven approaches for predicting physical properties of molecules and crystalline materials. Selected demos and examples of our work are available on the <a href="materials.html">Materials Sciecne Research page</a> of this website.',
      'hero.previous': 'Previously, I worked as an engineer at the NURIS Fab Lab, where I mentored students and early-stage startups, supporting the development of hardware and AI-driven prototypes.',
      'hero.visiting': 'I was also a visiting scholar at Texas A&M University, where I developed physics-informed neural networks under the supervision of <a href="https://engineering.tamu.edu/electrical/profiles/ubraganeto.html">Prof. Ulisses Braga-Neto</a>. This research visit was supported by a <a href="https://yessenovfoundation.org/en/eng-aidar-alimbayev/">Shakhmardan Yessenov Foundation Fellowship</a>.',
      'hero.ctaCv': 'Descargar CV',
      'hero.ctaEmail': 'Correo',
      'hero.ctaMaterials': 'Materials Sciecne Research page',
      'hero.interests': 'Intereses: remo, maratón y hardware confiable.',
      'materials.kicker': 'Ciencia de materiales',
      'materials.title': 'Materials Sciecne Research @ MBZUAI',
      'materials.body': 'Physics-informed and data-driven models for molecules and crystalline materials, with updates, demos, and benchmarks.',
      'materials.ctaPrimary': 'Open Materials Sciecne Research page',
      'materials.ctaSecondary': 'View Google Scholar',
      'materials.focus.title': 'Physics-informed + data-driven',
      'materials.focus.body': 'Hybrid models for property prediction across molecules and crystals, integrating domain priors with graph-based learning.',
      'materials.demos.title': 'Benchmarks and demos',
      'materials.demos.body': 'Follow along for curated datasets, baselines, and interactive examples as we release new experiments.',
      'materials.upcoming.title': 'Upcoming demos',
      'materials.upcoming.body': 'Interactive examples, baselines, and datasets as experiments mature. Collaborators welcome.',
      'materials.ctaScholar': 'View Google Scholar',
      'research.kicker': 'Previous Research',
      'research.title': 'Artículos destacados',
      'research.test.title': 'Banco de pruebas para fuentes móviles prometedoras',
      'research.test.authors': 'Publicación IEEE · A. S. Alimbaev y colegas',
      'research.test.link': 'PDF del artículo',
      'research.test.desc': 'Pruebas prolongadas de baterías con DAQ y LabVIEW, siguiendo la degradación.',
      'research.ppm.title': 'Modulación y demodulación PPM en NI FPGA',
      'research.ppm.authors': 'Artículo de conferencia · A. S. Alimbaev y colegas',
      'research.ppm.link': 'PDF del artículo',
      'research.ppm.desc': 'Validación de la demodulación en diferentes condiciones de canal.',
      'research.swarm.title': 'Experimentos de inteligencia de enjambre',
      'research.swarm.authors': 'En curso · Kit de simulación',
      'research.swarm.link': 'Ver demo',
      'research.swarm.desc': 'Herramientas visuales para estudiar la convergencia de algoritmos de enjambre.',
      'more.kicker': 'Explorar',
      'more.title': 'Más de Aidar',
      'more.primary': 'Materials Sciecne Research page',
      'more.materials.title': 'Ciencia de materiales',
      'more.materials.desc': 'Actualizaciones, conjuntos de datos y demos del proyecto principal.',
      'more.materials.link': 'Abrir página →',
      'more.social.title': 'Redes sociales',
      'more.social.desc': 'Cobertura en TV, noticias y fundaciones.',
      'more.social.link': 'Ver menciones →',
      'more.scholar.title': 'Google Scholar',
      'more.scholar.desc': 'Lista completa de artículos y coautores.',
      'more.scholar.link': 'Abrir perfil →',
      'contact.kicker': 'Contacto',
      'contact.title': 'Conectemos',
      'contact.body': 'Usa el formulario o escríbeme a <a class="underline" href="mailto:aidar.alimbayev@mbzuai.ac.ae">aidar.alimbayev@mbzuai.ac.ae</a>.',
      'contact.name': 'Nombre',
      'contact.email': 'Correo',
      'contact.message': 'Mensaje',
      'contact.submit': 'Enviar',
      'contact.sending': 'Enviando...',
      'footer.role': 'Investigador y creador de IA.'
    }
  };

  const translations = JSON.parse(JSON.stringify(baseTranslations));
  if (window.pageTranslations) {
    for (const [lang, dict] of Object.entries(window.pageTranslations)) {
      translations[lang] = Object.assign({}, translations[lang] || {}, dict);
    }
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('aidar-theme');
  const storedLang = localStorage.getItem('aidar-lang');
  const defaultLang = storedLang || 'en';
  const defaultTheme = storedTheme || (prefersDark ? 'dark' : 'light');
  let currentLang = defaultLang;

  function setDirection(lang) {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('aidar-theme', theme);
    const toggles = document.querySelectorAll('[data-role="theme-toggle"]');
    toggles.forEach(btn => {
      btn.querySelector('.sun-icon').classList.toggle('hidden', !isDark);
      btn.querySelector('.moon-icon').classList.toggle('hidden', isDark);
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    });
  }

  function getTranslation(lang, key) {
    return translations[lang]?.[key] || translations.en[key] || '';
  }

  function applyTranslations(lang) {
    document.documentElement.lang = lang;
    setDirection(lang);
    localStorage.setItem('aidar-lang', lang);
    currentLang = lang;
    document.querySelectorAll('[data-role="language-select"]').forEach(select => {
      if (select.value !== lang) select.value = lang;
    });

    document.querySelectorAll('[data-i18n]').forEach(node => {
      const key = node.dataset.i18n;
      const value = getTranslation(lang, key);
      if (value) node.textContent = value;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(node => {
      const key = node.dataset.i18nHtml;
      const value = getTranslation(lang, key);
      if (value) node.innerHTML = value;
    });
  }

  function initNav() {
    const nav = document.getElementById('site-nav');
    const mobileToggle = document.querySelector('[data-role="mobile-toggle"]');
    const mobileMenu = document.querySelector('[data-role="mobile-menu"]');

    if (nav) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 8) nav.classList.add('shadow-lg');
        else nav.classList.remove('shadow-lg');
      });
    }

    if (mobileToggle && mobileMenu) {
      mobileToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
      mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
      });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', event => {
        const targetId = anchor.getAttribute('href').slice(1);
        const target = document.getElementById(targetId);
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  function initForm() {
    const form = document.getElementById('contact-form');
    const status = document.getElementById('form-status');
    if (!form || !status) return;
    form.addEventListener('submit', (event) => {
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        return;
      }
      status.textContent = getTranslation(currentLang, 'contact.sending') || 'Sending...';
    });
  }

  function initYear() {
    const yearNode = document.getElementById('year');
    if (yearNode) yearNode.textContent = new Date().getFullYear();
  }

  function initControls() {
    document.querySelectorAll('[data-role="language-select"]').forEach(select => {
      select.addEventListener('change', () => applyTranslations(select.value));
    });

    document.querySelectorAll('[data-role="theme-toggle"]').forEach(button => {
      button.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        applyTheme(newTheme);
      });
    });
  }

  function init() {
    applyTheme(defaultTheme);
    applyTranslations(defaultLang);
    initNav();
    initControls();
    initYear();
    initForm();
  }

  document.addEventListener('DOMContentLoaded', init);
})(); 
