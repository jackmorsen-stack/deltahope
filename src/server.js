import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`Employment Application System listening on http://localhost:${config.port}`);
  console.log(`Data dir: ${config.dataDir}`);
});