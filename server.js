require('dotenv').config();
const express = require('express');
const neo4j = require('neo4j-driver');

const app = express();
app.use(express.json());
app.use(express.static('public')); 

const NEO_URI = process.env.NEO_URI; 
const NEO_USER = process.env.NEO_USER; 
const NEO_PASSWORD = process.env.NEO_PASSWORD;

if (!NEO_URI || !NEO_USER || !NEO_PASSWORD) {
  console.error("Ustaw zmienne środowiskowe NEO_URI, NEO_USER, NEO_PASSWORD");
  process.exit(1);
}

const driver = neo4j.driver(NEO_URI, neo4j.auth.basic(NEO_USER, NEO_PASSWORD));
const port = process.env.PORT || 3000;

async function runCypher(cypher, params = {}) {
  const session = driver.session();
  try {
    const res = await session.run(cypher, params);
    return res.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}


app.post('/api/query', async (req, res) => {
  const { cypher, params } = req.body;
  if (!cypher) return res.status(400).json({ error: 'Missing cypher' });

  try {
    const rows = await runCypher(cypher, params);
    
    
    const converted = rows.map(r => {
      const obj = {};
      for (const key in r) {
        
        if (r[key] && r[key].properties) {
          
          const props = { ...r[key].properties };
          
          for (const prop in props) {
            if (props[prop] && typeof props[prop].toNumber === 'function') {
              props[prop] = props[prop].toNumber();
            }
          }
          
          obj[key] = props;
          if (r[key].labels) obj[key + '_labels'] = r[key].labels;

        } else if (r[key] && typeof r[key].toNumber === 'function') {
           
           obj[key] = r[key].toNumber();
        } else {
           
           obj[key] = r[key];
        }
      }
      return obj;
    });

    res.json(converted);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});