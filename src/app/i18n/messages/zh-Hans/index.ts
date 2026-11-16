import type { Translation } from '../../schema';
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

/** zh-Hans. Loaded on demand (../../registry.ts). */
const messages: Translation = { common, glossary, log, errors, settings, home, lobby, game, prompts, gameover, feedback, tutorial, rules, seo };

export default messages;
