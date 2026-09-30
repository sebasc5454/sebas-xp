/* config.js: the game's numbers and names.
   Edit XP values, activity names, or quest rewards here. Everything else reads from this file. */

export const APP_VERSION = '2.0.0';

/* ---------- campaign defaults (Start date, daily target, and reset hour can also be changed in Setup) ---------- */
export const START = '2026-09-29';   // default campaign start date
export const PACE = 154;             // default daily XP target (56,175 XP / 365 days)
export const RESET_HOUR = 4;         // the game day rolls over at 4 AM local time
export const XP_TO_100 = 56175;      // total XP from LV 1 to LV 100

/* ---------- overall leveling: 5 tiers of 20 levels ---------- */
export const W = [300, 450, 575, 700, 825];   // XP per level in each tier
export const WSUM = 27675;                    // XP to max a 50-level tree shaped like W (used to scale tree costs)
export const TIERS = [['I','Apprentice','--tier1'],['II','Technician','--tier2'],['III','Engineer','--tier3'],['IV','Senior Engineer','--tier4'],['V','Chief Engineer','--tier5']];

/* ---------- skill trees: LV 1-50, new rank every 10 levels. T = expected XP per year ---------- */
export const TREES = [
  {id:'aca',name:'Academics',color:'--t-aca',T:15000,icon:'book',ranks:['Student','Scholar','Analyst','Theorist','Master']},
  {id:'eng',name:'Engineering',color:'--t-eng',T:5000,icon:'gear',ranks:['Tinkerer','Builder','Designer','Innovator','Architect']},
  {id:'skl',name:'Skills',color:'--t-skl',T:5000,icon:'bulb',ranks:['Novice','Learner','Practitioner','Specialist','Expert']},
  {id:'car',name:'Career',color:'--t-car',T:5000,icon:'case',ranks:['Candidate','Intern-Ready','Contender','Professional','Executive']},
  {id:'fit',name:'Fitness',color:'--t-fit',T:12000,icon:'bell',ranks:['Rookie','Starter','Captain','Beast','Elite']},
  {id:'soc',name:'Social',color:'--t-soc',T:3500,icon:'heart',ranks:['Solo','Connected','Reliable','Respected','Leader']},
  {id:'dis',name:'Discipline',color:'--t-dis',T:11500,icon:'glass',ranks:['Recruit','Consistent','Locked In','Relentless','Unbreakable']}
];
TREES.forEach(t => { t.costs = W.map(w => Math.max(10, Math.round(w * t.T / WSUM / 5) * 5)); });
export const TREE = Object.fromEntries(TREES.map(t => [t.id, t]));

/* ---------- activities ---------- */
/* [tree, id, name, xp, once] */
export const DEFAULT_ACTS=[
 ['aca','study','Focused study block (50 min, phone away)',20],
 ['aca','lecture','Watched a lecture with full focus',15],
 ['aca','preview','Previewed the next lecture',10],
 ['aca','hw','Homework set submitted',30],
 ['aca','hwEarly','Homework done a day early (bonus)',15],
 ['aca','noAI','Attempted every problem before using AI',20],
 ['aca','phys','Physics 2 concept session',25],
 ['aca','practice','Extra practice problems (not assigned)',20],
 ['aca','guide','Made a formula sheet or study guide',30],
 ['aca','teach','Explained a concept to someone else',20],
 ['aca','group','Study group session',25],
 ['aca','oh','Office hours or tutoring',25],
 ['aca','lab','Lab report submitted',50],
 ['aca','examFix','Reworked every missed exam problem',30],
 ['aca','quizA','Quiz: A',50],
 ['aca','quizB','Quiz: B',30],
 ['aca','examA','Exam: A',200],
 ['aca','examB','Exam: B',120],
 ['aca','examC','Exam: C',50],
 ['aca','allClass','Attended every class this week',40],
 ['aca','noLate','Zero late assignments this week',30],
 ['aca','advisor','Met with academic advisor',40],
 ['aca','register','Registered for next semester',50],
 ['aca','courseA','Final course grade: A',300],
 ['aca','courseB','Final course grade: B',150],
 ['aca','gpa','Semester GPA 3.5+',750],
 ['aca','deans',"Made the Dean's List",500],

 ['eng','build','1 hr hands-on project work (Arduino, build, CAD)',30],
 ['eng','plan','Chose a project and wrote the plan + parts list',75],
 ['eng','parts','Ordered parts or materials',25],
 ['eng','debug','Debugged and fixed a real problem',40],
 ['eng','milestone','Project milestone (subsystem works, first test)',100],
 ['eng','fab','3D printed or fabricated a part you designed',75],
 ['eng','circuit','Designed a circuit schematic',40],
 ['eng','cadReal','Modeled a real object in CAD (practice)',40],
 ['eng','github','Pushed project code to GitHub',20],
 ['eng','notebook','Design notebook entry',15],
 ['eng','finish','Finished a full project',400],
 ['eng','document','Documented a project (photos + write-up)',100],
 ['eng','present','Presented a project to others',75],
 ['eng','teardown','Product teardown or reverse-engineering',40],
 ['eng','fix','Fixed something broken (car, bike, appliance)',40],
 ['eng','pc','Built or upgraded a PC',100],
 ['eng','clubMtg','Engineering club or team meeting',25],
 ['eng','teamTask','Contributed to a team design task',50],
 ['eng','joinClub','Joined an engineering club or team',200,1],
 ['eng','fsae','FSAE reapplication submitted',150,1],
 ['eng','compIn','Entered a hackathon or design competition',200],
 ['eng','compWin','Placed in a competition',400],

 ['skl','learn','1 hr structured learning (course or tutorial)',30],
 ['skl','code','1 hr coding (Python, MATLAB, C++)',30],
 ['skl','module','Course module or lesson completed',25],
 ['skl','course','Full online course completed',250],
 ['skl','matlabHw','Used MATLAB on a homework problem',25],
 ['skl','cadTech','Learned a new CAD feature or technique',20],
 ['skl','tool','Learned a new tool hands-on (solder, 3D printer, scope, lathe)',50],
 ['skl','workshop','Attended a workshop or seminar',40],
 ['skl','shop','Makerspace or machine shop training',150],
 ['skl','research','1 hr engineering research or reading',20],
 ['skl','book','Read a chapter of a technical book',25],
 ['skl','learnLog','Wrote down what you learned today',10],
 ['skl','mlOnramp','MATLAB Onramp certificate',150,1],
 ['skl','simOnramp','Simulink Onramp certificate',150,1],
 ['skl','cswa','SolidWorks CSWA certification',500,1],
 ['skl','cswp','SolidWorks CSWP certification',800,1],
 ['skl','cert','Other certification earned',300],
 ['skl','profEmail','Emailed a professor about research',75],
 ['skl','furiApp','FURI application submitted',300],
 ['skl','researchIn','Joined a research lab or got into FURI',750,1],

 ['car','intApp','Internship application sent',30],
 ['car','jobApp','Part-time job application sent',20],
 ['car','cover','Tailored cover letter written',25],
 ['car','followUp','Followed up on an application',10],
 ['car','company','Researched a target company or role',20],
 ['car','resume','Resume or LinkedIn update',40],
 ['car','resumeProj','Added a project to resume or portfolio',50],
 ['car','portfolio','Built an engineering portfolio',300,1],
 ['car','connect','Connected with an engineer or recruiter (with a message)',15],
 ['car','network','Networking chat or informational interview',60],
 ['car','infoSession','Company info session or engineering event',50],
 ['car','society','Joined a professional society (ASME, AIAA)',150,1],
 ['car','star','Wrote STAR interview stories',40],
 ['car','pitch','Wrote and practiced an elevator pitch',40,1],
 ['car','mock','Mock interview at career services',75],
 ['car','fair','Career fair',100],
 ['car','interview','Interview',150],
 ['car','thanks','Sent a thank-you after an interview',20],
 ['car','shift','Worked a job shift',20],
 ['car','jobOffer','Job offer',500],
 ['car','intOffer','Internship offer',1000],
 ['car','scholar','Scholarship application submitted',50],
 ['car','abroad','Researched study abroad or programs (1 hr)',20],
 ['car','ucList','UC transfer: school list finalized',100,1],
 ['car','ucReq','UC transfer: checked major requirements for a school',50],
 ['car','ucPiq','UC transfer: PIQ essay drafted',75],
 ['car','ucPiqF','UC transfer: PIQ essay finalized',100],
 ['car','ucSec','UC transfer: application section done',50],
 ['car','ucSubmit','UC transfer: application submitted',400],
 ['car','ucAdmit','UC transfer: admitted',1500],

 ['fit','conditioning','Rugby morning conditioning',30],
 ['fit','rugbyPrac','Rugby practice, full effort',30],
 ['fit','rugbySkill','Rugby skill work on your own',20],
 ['fit','match','Played in a match',50],
 ['fit','try','Scored a try',50],
 ['fit','lift','Program lift, full effort',30],
 ['fit','runSwim','Run or swim',25],
 ['fit','sprint','Sprint or speed session',30],
 ['fit','hike','Hike',30],
 ['fit','recovery','Recovery session (stretch, massage gun)',15],
 ['fit','steps','Step goal hit',10],
 ['fit','protein','Hit protein target',10],
 ['fit','water','Hit water goal',5],
 ['fit','pr','PR',50],
 ['fit','progWeek','Every program session done this week',75],
 ['fit','block','Completed a full training block',150],

 ['soc','family','Real conversation with family',20],
 ['soc','close','Quality time or call with someone close',20],
 ['soc','friend','Reached out to a friend',20],
 ['soc','invite','Invited someone to do something',30],
 ['soc','hangout','Social event or hangout',40],
 ['soc','campus','Went to a campus event',30],
 ['soc','newPerson','Met someone new',40],
 ['soc','speakUp','Spoke up in class or a group',15],
 ['soc','help','Helped someone out',25],
 ['soc','hobby','Hobby session (fishing, etc.)',30],
 ['soc','newThing','Tried a new hobby or experience',50],
 ['soc','groupJoin','Joined a non-engineering club or group',100],

 ['dis','sleep','7+ hrs sleep',15],
 ['dis','bedtime','In bed by target time',15],
 ['dis','alarm','Up on the first alarm',15],
 ['dis','noPhoneAM','No phone first 30 min after waking',15],
 ['dis','hardFirst','Hardest task first, before phone',20],
 ['dis','stack','Daily stack taken',10],
 ['dis','planTmrw','Planned tomorrow the night before',10],
 ['dis','weekly','Weekly review and plan (Sunday)',50],
 ['dis','cook','Cooked instead of junk food',15],
 ['dis','mealPrep','Meal prepped for multiple days',30],
 ['dis','noJunk','No junk food all day',10],
 ['dis','screen','Screen time under target',15],
 ['dis','phoneOut','Phone out of the bedroom overnight',10],
 ['dis','admin','Admin knocked out (emails, calls, forms)',20],
 ['dis','procrast',"Finally did something you'd been putting off",30],
 ['dis','clean','Cleaned space, dishes, trash',10],
 ['dis','laundry','Laundry done',10],
 ['dis','groom','Groomed and dressed sharp',10],
 ['dis','budget','Checked your budget and spending',20],
 ['dis','read','Read 20 min (non-school)',15],
 ['dis','journal','Journaled or reflected (5 min)',10],
 ['dis','sails','SAILS setup completed',50,1]
];

/* ---------- bonuses (same as the original app) ---------- */
export const BONUS = {
  perfect:  {n:'Perfect Day',   x:25},    // every Perfect Day habit logged in one day
  streak7:  {n:'7-Day Streak',  x:100},   // every 7th day in a row of 100+ XP
  streak30: {n:'30-Day Streak', x:500}    // every 30th day in a row of 100+ XP
};
export const STREAK_MIN = 100;           // a day counts toward a streak at 100+ XP (bonuses not included)

/* ---------- quests ---------- */
export const QUEST_XP = { act: 10, challenge: 20, boss: 150 };
/* activities that make sense to do more than once a day ("Log 2 study blocks") */
export const STACKABLE = ['study','lecture','practice','build','learn','code','module','research','book','intApp','jobApp','cover','connect','company','followUp','debug','cadReal','rugbySkill'];
/* weekly bosses: kind 'act' = log activity n times, 'tree' = earn n XP in a tree, 'days' = n days of 100+ XP */
export const BOSSES = [
  {id:'hydra',  name:'The Application Hydra', kind:'act',  a:'intApp', n:5},
  {id:'golem',  name:'The Library Golem',     kind:'act',  a:'study',  n:12},
  {id:'colossus',name:'The Iron Colossus',    kind:'act',  a:'lift',   n:4},
  {id:'wyrm',   name:'The Workshop Wyrm',     kind:'act',  a:'build',  n:5},
  {id:'kraken', name:'The Code Kraken',       kind:'act',  a:'code',   n:5},
  {id:'dragon', name:'The Streak Dragon',     kind:'days', n:5},
  {id:'lich',   name:'The Hermit Lich',       kind:'tree', t:'soc', n:150},
  {id:'specter',name:'The Network Specter',   kind:'tree', t:'car', n:200}
];

/* ---------- settings saved with your data ---------- */
export const DEFAULT_SETTINGS = {
  v:2, startDate:START, dailyTarget:PACE, resetHour:RESET_HOUR,
  sound:true, haptics:true, nudges:true, showHidden:false,
  favorites:['study','lecture','hw','noAI','build','learn','intApp','conditioning','rugbyPrac','lift','family','friend','sleep','alarm','hardFirst','stack','planTmrw','cook','clean'],
  perfect:['sleep','alarm','hardFirst','stack','planTmrw'],
  overrides:{}, hidden:[], onceOverrides:{}, custom:[],
  lastBackup:0, installedSeen:false
};

/* ---------- cloud sync (optional) ----------
   Paste your Supabase project's URL and publishable/anon key here to sync between devices.
   Both are safe to publish: the database rules in supabase/schema.sql only let you read your own data.
   Leave them empty to keep everything on-device only. See README → Cloud sync. */
export const SYNC = {
  url: 'https://gvxmzilrodwoyycxtqen.supabase.co',
  key: 'sb_publishable_hhQI6ipINNzh0giHSdn0Zw_hj9zQd6t'
};
