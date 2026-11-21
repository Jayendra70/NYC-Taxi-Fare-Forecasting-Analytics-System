require('dotenv').config({ quiet: true });
const app = require('./app');

const port = Number(process.env.PORT) || 5001;
app.listen(port, () => console.log(`API gateway listening on http://localhost:${port}`));
