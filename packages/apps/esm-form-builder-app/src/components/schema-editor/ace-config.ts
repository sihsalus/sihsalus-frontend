import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-textmate';
import 'ace-builds/src-noconflict/ext-searchbox';

// Bundle the worker with the app, preserving JSON syntax validation without
// loading Ace's complete language/theme catalog or requiring file-loader.
ace.config.setModuleUrl(
  'ace/mode/json_worker',
  new URL('ace-builds/src-noconflict/worker-json.js', import.meta.url).href,
);

export { addCompleter } from 'ace-builds/src-noconflict/ext-language_tools';
