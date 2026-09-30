/* achievements.js: badges. Each one is checked against your log every time something changes,
   so they're never out of sync. `have` returns a number; the badge unlocks when have >= need.
   ctx = { s: lifetimeStats, snap: snapshot, settings } */
import { TREES, TIERS } from './config.js';
import { rankIdx } from './leveling.js';

const c = (ctx, ...ids) => ids.reduce((sum, id) => sum + (ctx.s.counts[id] || 0), 0);   // times you logged these activities

export const GROUPS = [
  ['start', 'MILESTONES'], ['habit', 'STREAKS & HABITS'], ['quest', 'QUESTS'],
  ['level', 'LEVELS'], ['life', 'REAL-LIFE WINS'], ['tree', 'TREE RANKS']
];

const LIST = [
  /* milestones */
  { id:'first',     g:'start', icon:'play',   name:'Press Start',      desc:'Log your first activity',            need:1,    have:x => x.s.logs },
  { id:'century',   g:'start', icon:'bolt',   name:'Century',          desc:'Earn 100+ XP in one day',            need:1,    have:x => x.s.centuryDays },
  { id:'onpace',    g:'start', icon:'target', name:'On Pace',          desc:'Hit your daily target in one day',   need:1,    have:x => x.s.targetDays },
  { id:'overdrive', g:'start', icon:'rocket', name:'Overdrive',        desc:'Earn 300 XP in one day',             need:300,  have:x => x.s.maxDay.xp },
  { id:'renaiss',   g:'start', icon:'gem',    name:'Renaissance',      desc:'Log in all 7 trees in one day',      need:7,    have:x => x.s.maxTrees },
  { id:'logs100',   g:'start', icon:'scroll', name:'Logbook',          desc:'Log 100 activities',                 need:100,  have:x => x.s.logs },
  { id:'logs1000',  g:'start', icon:'scroll', name:'Chronicler',       desc:'Log 1,000 activities',               need:1000, have:x => x.s.logs },
  { id:'days50',    g:'start', icon:'cal',    name:'Showed Up',        desc:'Be active on 50 different days',     need:50,   have:x => x.s.daysActive },
  { id:'days200',   g:'start', icon:'cal',    name:'Campaigner',       desc:'Be active on 200 different days',    need:200,  have:x => x.s.daysActive },
  { id:'backup',    g:'start', icon:'disk',   name:'Safe Keeper',      desc:'Export a backup of your save file',  need:1,    have:x => x.settings.lastBackup ? 1 : 0 },
  { id:'installed', g:'start', icon:'phone',  name:'Home Screen Hero', desc:'Open Sebas XP as an installed app',  need:1,    have:x => x.settings.installedSeen ? 1 : 0 },
  /* streaks & habits */
  { id:'streak7',   g:'habit', icon:'flame',  name:'Week Warrior',     desc:'7-day streak of 100+ XP days',       need:7,    have:x => x.s.bestStreak },
  { id:'streak30',  g:'habit', icon:'flame',  name:'Iron Month',       desc:'30-day streak',                      need:30,   have:x => x.s.bestStreak },
  { id:'streak100', g:'habit', icon:'flame',  name:'Unbroken',         desc:'100-day streak',                     need:100,  have:x => x.s.bestStreak },
  { id:'perfect1',  g:'habit', icon:'check',  name:'Flawless',         desc:'Complete your first Perfect Day',    need:1,    have:x => x.s.perfectDays },
  { id:'perfect30', g:'habit', icon:'check',  name:'Creature of Habit',desc:'30 Perfect Days',                    need:30,   have:x => x.s.perfectDays },
  { id:'early',     g:'habit', icon:'sun',    name:'Early Bird',       desc:'Up on the first alarm 30 times',     need:30,   have:x => c(x,'alarm') },
  { id:'sleep',     g:'habit', icon:'moon',   name:'Well Rested',      desc:'30 nights of 7+ hrs sleep',          need:30,   have:x => c(x,'sleep') },
  { id:'hardfirst', g:'habit', icon:'sword',  name:'Eat the Frog',     desc:'Hardest task first, 30 times',       need:30,   have:x => c(x,'hardFirst') },
  { id:'cook',      g:'habit', icon:'pot',    name:'Home Cook',        desc:'Cook instead of junk food 25 times', need:25,   have:x => c(x,'cook','mealPrep') },
  /* quests */
  { id:'quest1',    g:'quest', icon:'flag',   name:'Quest Taker',      desc:'Complete a daily quest',             need:1,    have:x => x.s.questsDone },
  { id:'board',     g:'quest', icon:'flag',   name:'Full Board',       desc:'Clear all 3 daily quests in a day',  need:1,    have:x => x.s.fullBoards },
  { id:'quests50',  g:'quest', icon:'map',    name:'Adventurer',       desc:'Complete 50 daily quests',           need:50,   have:x => x.s.questsDone },
  { id:'quests200', g:'quest', icon:'map',    name:'Legend',           desc:'Complete 200 daily quests',          need:200,  have:x => x.s.questsDone },
  { id:'boss1',     g:'quest', icon:'sword',  name:'Boss Slayer',      desc:'Defeat a weekly boss',               need:1,    have:x => x.s.bosses },
  { id:'boss10',    g:'quest', icon:'skull',  name:'Monster Hunter',   desc:'Defeat 10 weekly bosses',            need:10,   have:x => x.s.bosses },
  /* levels */
  { id:'lv10',      g:'level', icon:'up',     name:'Getting Started',  desc:'Reach LV 10',                        need:10,   have:x => x.snap.o.L },
  ...TIERS.slice(1).map((t, i) => ({ id:'tier' + (i + 2), g:'level', icon:'shield', color:t[2], name:t[1], desc:`Reach Tier ${t[0]} (LV ${(i + 1) * 20 + 1})`, need:(i + 1) * 20 + 1, have:x => x.snap.o.L })),
  { id:'lv50',      g:'level', icon:'up',     name:'Halfway There',    desc:'Reach LV 50',                        need:50,   have:x => x.snap.o.L },
  { id:'lv100',     g:'level', icon:'crown',  name:'Max Level',        desc:'Reach LV 100',                       need:100,  have:x => x.snap.o.L },
  /* real-life wins */
  { id:'apps10',    g:'life',  icon:'mail',   name:'Applicant',        desc:'Send 10 internship applications',    need:10,   have:x => c(x,'intApp') },
  { id:'apps50',    g:'life',  icon:'mail',   name:'Relentless',       desc:'Send 50 internship applications',    need:50,   have:x => c(x,'intApp') },
  { id:'network',   g:'life',  icon:'link',   name:'Networker',        desc:'10 networking chats or messages',    need:10,   have:x => c(x,'connect','network') },
  { id:'interview', g:'life',  icon:'tie',    name:'In the Room',      desc:'Land an interview',                  need:1,    have:x => c(x,'interview') },
  { id:'offer',     g:'life',  icon:'star',   name:'Hired',            desc:'Get an internship or job offer',     need:1,    have:x => c(x,'intOffer','jobOffer') },
  { id:'milestone', g:'life',  icon:'gear',   name:'It Works!',        desc:'Hit a project milestone',            need:1,    have:x => c(x,'milestone') },
  { id:'project',   g:'life',  icon:'wrench', name:'Ship It',          desc:'Finish a full project',              need:1,    have:x => c(x,'finish') },
  { id:'cswa',      g:'life',  icon:'medal',  name:'Certified',        desc:'Earn the SolidWorks CSWA',           need:1,    have:x => c(x,'cswa') },
  { id:'cswp',      g:'life',  icon:'medal',  name:'CAD Pro',          desc:'Earn the SolidWorks CSWP',           need:1,    have:x => c(x,'cswp') },
  { id:'research',  g:'life',  icon:'flask',  name:'Lab Rat',          desc:'Join a research lab or FURI',        need:1,    have:x => c(x,'researchIn') },
  { id:'study100',  g:'life',  icon:'book',   name:'Deep Worker',      desc:'100 focused study blocks',           need:100,  have:x => c(x,'study') },
  { id:'examA',     g:'life',  icon:'star',   name:'Ace',              desc:'Get an A on an exam',                need:1,    have:x => c(x,'examA') },
  { id:'deans',     g:'life',  icon:'cap',    name:"Dean's List",      desc:"Make the Dean's List",               need:1,    have:x => c(x,'deans') },
  { id:'transfer',  g:'life',  icon:'mail',   name:'Transfer Ready',   desc:'Submit a UC transfer application',   need:1,    have:x => c(x,'ucSubmit') },
  { id:'admit',     g:'life',  icon:'cap',    name:'Admitted',         desc:'Get admitted to a UC',               need:1,    have:x => c(x,'ucAdmit') },
  { id:'lift50',    g:'life',  icon:'bell',   name:'Iron Addict',      desc:'50 program lifts',                   need:50,   have:x => c(x,'lift') },
  { id:'try',       g:'life',  icon:'ball',   name:'Try Time',         desc:'Score a try',                        need:1,    have:x => c(x,'try') },
  { id:'pr',        g:'life',  icon:'up',     name:'New PR',           desc:'Set a personal record',              need:1,    have:x => c(x,'pr') },
  { id:'social50',  g:'life',  icon:'heart',  name:'Good Company',     desc:'Log 50 Social activities',           need:50,   have:x => x.s.treeLogs.soc || 0 },
  /* tree ranks: one badge per rank above the first, in every tree */
  ...TREES.flatMap(t => t.ranks.slice(1).map((r, i) => ({
    id:`rank-${t.id}-${i + 1}`, g:'tree', icon:t.icon, color:t.color, name:r, desc:`${t.name} LV ${(i + 1) * 10 + 1}`, need:i + 1,
    have:x => rankIdx(x.snap.trees[t.id].L)
  })))
];
export const BADGES = LIST;

export function evaluateBadges(ctx) {
  return BADGES.map(b => { const have = b.have(ctx); return Object.assign({}, b, { have, got: have >= b.need }); });
}
export function unlockedIds(ctx) { return new Set(evaluateBadges(ctx).filter(b => b.got).map(b => b.id)); }
