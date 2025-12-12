// --- API HELPER ---
    async function api(path, opts = {}) {
      const res = await fetch(path, opts);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    // --- RENDER TABLE ---
    function renderList(items) {
      const container = document.getElementById('result');
      if (!items || items.length === 0) {
        container.innerHTML = '<i>No results</i>';
        return;
      }
      
      // Tworzenie tabeli
      let html = '<table><thead><tr>';
      const keys = Object.keys(items[0]);
      keys.forEach(k => html += `<th>${k}</th>`);
      html += '</tr></thead><tbody>';
      
      items.forEach(it => {
        html += '<tr>';
        keys.forEach(k => {
          let v = it[k];
          if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
          html += `<td>${v ?? ''}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    // --- LOGIKA PRZYCISKÓW ---
    
    // Uniwersalna funkcja do pobierania węzłów danego typu
    async function loadNodesByLabel(label) {
        try {
            // Pobieramy konkretne pola, żeby tabela była ładna, a nie surowy JSON
            const cypher = `MATCH (n:${label}) RETURN n.name as Name, n.id as ID, labels(n) as Labels ORDER BY n.id`;
            
            const data = await api('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cypher })
            });
            renderList(data);
        } catch (e) {
            document.getElementById('result').textContent = 'Error: ' + e.message;
        }
    }

    document.getElementById('btnSuspects').addEventListener('click', () => loadNodesByLabel('Suspect'));
    document.getElementById('btnWitnesses').addEventListener('click', () => loadNodesByLabel('Witness'));
    document.getElementById('btnVictims').addEventListener('click', () => loadNodesByLabel('Victim'));
    document.getElementById('btnEvidence').addEventListener('click', () => loadNodesByLabel('Evidence'));
    document.getElementById('btnScenes').addEventListener('click', () => loadNodesByLabel('CrimeScene'));

    // Własne zapytanie
    document.getElementById('runQuery').addEventListener('click', async () => {
      try {
        const cy = document.getElementById('cypher').value;
        const data = await api('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cypher: cy })
        });
        renderList(data);
      } catch (e) { document.getElementById('result').textContent = e; }
    });

    // --- WIZUALIZACJA GRAFU (VIS.JS) ---
    async function drawGraph() {
      // Pobieramy etykiety jawnie, aby poprawnie kolorować węzły
      const cypher = `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, labels(n) as n_labels, r, m, labels(m) as m_labels
      `;
      
      try {
        const data = await api('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cypher })
        });

        const nodes = [];
        const edges = [];
        const nodeMap = new Map();

        function addNode(nodeObj, extraLabels) {
            if (!nodeObj) return;
            const id = nodeObj.id || nodeObj.properties?.id;
            
            // Unikanie duplikatów
            if (!id || nodeMap.has(id)) return;
            nodeMap.set(id, true);

            // Pobieranie etykiet (z extraLabels lub z samego obiektu)
            const rawLabels = extraLabels || nodeObj.labels;
            const labels = Array.isArray(rawLabels) ? rawLabels : (rawLabels ? [rawLabels] : []);
            
            const props = nodeObj.properties || nodeObj;

            // Przypisanie grupy na podstawie etykiety
            let group = "Other";
            if (labels.includes("Witness")) group = "Witness";
            else if (labels.includes("Suspect")) group = "Suspect";
            else if (labels.includes("Victim")) group = "Victim";
            else if (labels.includes("CrimeScene")) group = "CrimeScene";
            else if (labels.includes("Evidence")) group = "Evidence";

            nodes.push({
                id: id,
                label: props.name || id,
                group: group,
                title: `ID: ${id}\nLabels: ${labels.join(', ')}` // Tooltip
            });
        }

        data.forEach(row => {
            const n = row.n;
            const m = row.m;
            const r = row.r;

            addNode(n, row.n_labels);
            addNode(m, row.m_labels);

            if (r && n && m) {
                // Etykieta krawędzi: rola, notatka, data lub pusta
                const edgeLabel = r.roleInEvidence || r.note || r.datetime || "";
                edges.push({
                    from: n.id || n.properties?.id,
                    to: m.id || m.properties?.id,
                    label: edgeLabel
                });
            }
        });

        const container = document.getElementById('graph');
        const networkData = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };

        const options = {
            nodes: { 
                shape: 'dot', 
                size: 20,
                font: { size: 14, color: '#000' },
                borderWidth: 2
            },
            edges: { 
                arrows: 'to', 
                color: { color: '#848484' },
                font: { align: 'top', size: 11, background: 'rgba(255,255,255,0.7)' } 
            },
            groups: {
                Witness:    { color: '#5dade2' }, 
                Victim:     { color: '#9b59b6' }, 
                Suspect:    { color: '#e74c3c' }, 
                CrimeScene: { color: '#58d68d' }, 
                Evidence:   { color: '#f39c12' }, 
                Other:      { color: '#95a5a6' }
            },
            physics: { 
                stabilization: true,
                barnesHut: { gravitationalConstant: -3000 } 
            },
            interaction: { hover: true, zoomView: false }
        };

        const network = new vis.Network(container, networkData, options);

        // Zoom tylko z CTRL
        container.addEventListener("wheel", (event) => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
            const scale = network.getScale();
            network.moveTo({ scale: scale * zoomFactor });
        });

      } catch (err) {
          console.error(err);
      }
    }

    document.getElementById('addNodeBtn').addEventListener('click', () => {
        const panel = document.getElementById('addNodePanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('confirmAddNode').addEventListener('click', async () => {
        const label = document.getElementById('nodeLabel').value;
        const name = document.getElementById('nodeName').value.trim();

        if (!name) {
            alert("Type name!");
            return;
        }

        try {
            // Pobieranie największego ID dla danej etykiety
            const idPrefix = {
                Suspect: "S",
                Witness: "W",
                Victim: "V",
                CrimeScene: "C",
                Evidence: "E"
            }[label];

            const cypherMaxId = `
                MATCH (n:${label})
                WITH n ORDER BY n.id DESC LIMIT 1
                RETURN n.id AS lastId
            `;

            const res = await api('/api/query', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cypher: cypherMaxId })
            });

            let newIdNum = 1;
            if (res.length > 0 && res[0].lastId) {
                // wyciągamy liczbę z ID np. “S3” -> 3
                const num = parseInt(res[0].lastId.replace(/\D+/g, ""));
                newIdNum = num + 1;
            }

            const newId = idPrefix + newIdNum;

            // Tworzenie węzła
            const cypherCreate = `
                CREATE (n:${label} {id: $id, name: $name})
                RETURN n
            `;

            await api("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cypher: cypherCreate,
                    params: { id: newId, name: name }
                })
            });

            alert(`Dodano: ${label} "${name}" z ID ${newId}`);

            // czyszczenie
            document.getElementById('nodeName').value = "";

            // odświeżenie tabeli i grafu
            loadNodesByLabel(label);
            drawGraph();

        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        }
    });

      document.getElementById('addRelationBtn').addEventListener('click', () => {
      const panel = document.getElementById('addRelationPanel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      });

    // Definicja dozwolonych relacji
    const relationRules = {
        "KILLED_AT":      { from: "Victim",   to: "CrimeScene" },
        "WITNESSED":      { from: "Witness",  to: "Suspect" },
        "WAS_AT":         { from: "Witness",  to: "CrimeScene" },
        "FOUND_AT":       { from: "Evidence", to: "CrimeScene" },
        "EVIDENCE_OF":    { from: "Evidence", to: "Suspect" }
    };

    const nodeColors = {
        Witness:    '#5dade2',
        Victim:     '#9b59b6',
        Suspect:    '#e74c3c',
        CrimeScene: '#58d68d',
        Evidence:   '#f39c12'
    };

    // GENERATOR LEGENDY
    function renderLegend() {
        const legendContainer = document.getElementById("legendContent");
        legendContainer.innerHTML = "";

        Object.entries(relationRules).forEach(([relName, rule]) => {
            const fromColor = nodeColors[rule.from] || '#aaa';
            const toColor   = nodeColors[rule.to]   || '#aaa';

            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.marginBottom = "6px";

            row.innerHTML = `
                <span style="width:90px; display:inline-block;">${relName}</span>
                <span style="
                    width:12px; height:12px; border-radius:50%; 
                    background:${fromColor}; margin:0 6px 0 4px;
                "></span>
                →
                <span style="
                    width:12px; height:12px; border-radius:50%; 
                    background:${toColor}; margin-left:6px;
                "></span>
            `;

            legendContainer.appendChild(row);
        });
    }

    document.getElementById('confirmAddRelation').addEventListener('click', async () => {
        const type = document.getElementById('relationType').value;
        const fromId = document.getElementById('relFrom').value.trim();
        const toId = document.getElementById('relTo').value.trim();

        if (!fromId || !toId) {
            alert("Type both IDs!");
            return;
        }

        const expected = relationRules[type];
        if (!expected) {
            alert("Relation doesn\'t exist.");
            return;
        }

        try {
            // Sprawdzenie, czy od–do pasują etykiety
            const cypherCheck = `
                MATCH (a {id: $aId}), (b {id: $bId})
                RETURN labels(a) as aLabels, labels(b) as bLabels
            `;

            const checkRes = await api('/api/query', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cypher: cypherCheck,
                    params: { aId: fromId, bId: toId }
                })
            });

            if (checkRes.length === 0) {
                alert("Nodes with such IDs were not found.");
                return;
            }

            const aLabels = checkRes[0].aLabels;
            const bLabels = checkRes[0].bLabels;

            if (!aLabels.includes(expected.from)) {
                alert(`Source ID must be type of: ${expected.from}`);
                return;
            }
            if (!bLabels.includes(expected.to)) {
                alert(`Target ID must be type of: ${expected.to}`);
                return;
            }

            // Tworzenie relacji
            const cypherCreate = `
                MATCH (a:${expected.from} {id:$aId}), (b:${expected.to} {id:$bId})
                MERGE (a)-[r:${type}]->(b)
                RETURN r
            `;

            await api('/api/query', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cypher: cypherCreate,
                    params: { aId: fromId, bId: toId }
                })
            });

            alert(`Utworzono relację: ${expected.from}(${fromId}) -[${type}]-> ${expected.to}(${toId})`);

            // czyszczenie pól
            document.getElementById('relFrom').value = "";
            document.getElementById('relTo').value = "";

            // odświeżenie grafu
            drawGraph();

        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        }
    });

    document.getElementById('deleteNodeBtn').addEventListener('click', () => {
        const p = document.getElementById('deleteNodePanel');
        p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('confirmDeleteNode').addEventListener('click', async () => {
        const id = document.getElementById('deleteNodeId').value.trim();

        if (!id) {
            alert("Enter node ID!");
            return;
        }

        try {
            const cypher = `
                MATCH (n {id:$id})
                DETACH DELETE n
            `;

            await api('/api/query', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cypher, params: { id } })
            });

            alert("Node deleted along with relations.");
            document.getElementById('deleteNodeId').value = "";
            drawGraph();
        }
        catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        }
    });

    document.getElementById('deleteRelationBtn').addEventListener('click', () => {
        const p = document.getElementById('deleteRelationPanel');
        p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('confirmDeleteRelation').addEventListener('click', async () => {
        const type = document.getElementById('deleteRelationType').value;
        const fromId = document.getElementById('delRelFrom').value.trim();
        const toId = document.getElementById('delRelTo').value.trim();

        if (!fromId || !toId) {
            alert("Enter both IDs!");
            return;
        }

        try {
            const cypher = `
                MATCH (a {id:$fromId})-[r:${type}]->(b {id:$toId})
                DELETE r
                RETURN r
            `;

            const res = await api('/api/query', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cypher,
                    params: { fromId, toId }
                })
            });

            alert("Relation deleted (if existed).");

            document.getElementById('delRelFrom').value = "";
            document.getElementById('delRelTo').value = "";

            drawGraph();
        }
        catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        }
    });

    document.getElementById('editNodeBtn').addEventListener('click', () => {
        const panel = document.getElementById('editNodePanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('confirmEditNode').addEventListener('click', async () => {
        const id = document.getElementById('editNodeId').value.trim();
        const newName = document.getElementById('editNodeName').value.trim();

        if (!id || !newName) {
            alert("Type ID and new name!");
            return;
        }

        try {
            const cypher = `
                MATCH (n {id: $id})
                SET n.name = $newName
                RETURN labels(n) AS labels, n.id AS id, n.name AS name
            `;

            const result = await api('/api/query', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cypher, params: { id, newName } })
            });

            if (result.length === 0) {
                alert("Node with given ID not found!");
                return;
            }

            alert(`Updated node ${id}: new name = "${newName}"`);

            // czyszczenie
            document.getElementById('editNodeName').value = "";

            // odświeżenie wyświetlanego typu (na podstawie label)
            const type = result[0].labels[0];
            if (type) loadNodesByLabel(type);

            drawGraph();

        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        }
    });



    window.onload = () => {
      drawGraph();
      renderLegend();
    };