/**
 * The English catalog: the source of truth. Its shape defines every key
 * (`MessageKey` in ../../schema.ts); other locales are typed against it.
 * English ships in the main bundle; other locales load on demand.
 *
 * One file per namespace so agents can add keys to different areas without
 * touching the same file. Add a namespace here and in every locale folder.
 */
import common from './common';
import glossary from './glossary';
import log from './log';
import errors from './errors';
import settings from './settings';
import home from './home';
import lobby from './lobby';
import game from './game';
import prompts from './prompts';
import gameover from './gameover';
import feedback from './feedback';
import tutorial from './tutorial';
import rules from './rules';
import seo from './seo';
import stats from './stats';

const en = { common, glossary, log, errors, settings, home, lobby, game, prompts, gameover, feedback, tutorial, rules, seo, stats };

export default en;
