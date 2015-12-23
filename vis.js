function getLabel(nodeData) {
    if (nodeData.value === null) {
        var split = nodeData.itemIdentifier.split(/[\/#]/);
        return split[split.length - 1];
    } else {
        return nodeData.value;
    }
}

var nodeDataDict = {};  // lookup by uuid
var nodeVisDict = {};  // lookup by uuid

var edgeDict = {};

var nodes = new vis.DataSet([]);
var edges = new vis.DataSet([]);

// create a network
var container = document.getElementById('mynetwork');

var vis_data  = {
    nodes: nodes,
    edges: edges
};
var options = {
    interaction: {
        hover: true
    },
    physics: {
        barnesHut: {
            gravitationalConstant: -20000
        }
    }
};

var network = new vis.Network(container, vis_data, options);

function addNode(nodeData) {
    if (!(nodeData.uuid in nodeVisDict)) {
        // If this is a constraint, do nothing
        if (getLabel(nodeData)[0] === "$") {
            return;
        }

        nodeVis = {
            id: nodeData.uuid,
            label: getLabel(nodeData),
            selected: false
        };

        nodeVisDict[nodeData.uuid] = nodeVis;
        nodeDataDict[nodeData.uuid] = nodeData;
        nodes.add(nodeVis);
    }
}

function removeNode(nodeId) {
    nodes.remove(nodeVisDict[nodeId]);
    delete nodeDataDict[nodeId];
    delete nodeVisDict[nodeId];
}

function addEdge(fromId, toId, type) {
    var edgeVis = {
        from: fromId,
        to: toId,
        label: type
    };

    if (!(edgeVis.label in edgeDict)) {
        edgeDict[edgeVis.label] = {};
    }
    if (!(edgeVis.from in edgeDict[edgeVis.label])) {
        edgeDict[edgeVis.label][edgeVis.from] = {}
    }
    if (!(edgeVis.to in edgeDict[edgeVis.label][edgeVis.from])) {
        edgeDict[edgeVis.label][edgeVis.from][edgeVis.to] = edgeVis;
        edges.add(edgeVis);
    }
}

function addEdges(nodeData) {
    $.each(nodeData.out, function(i, edge) {
        addNode(edge.source);
        addNode(edge.target);
        addEdge(edge.source.uuid, edge.target.uuid, edge.type);
    });

    $.each(nodeData.in, function(i, edge) {
        addNode(edge.source);
        addNode(edge.target);
        addEdge(edge.source.uuid, edge.target.uuid, edge.type);
    });
}

network.on("click", function (params) {
    if (params.nodes.length > 0) {
        var id = params.nodes[0];

        var nodeVis = nodeVisDict[id];

        // Mark node
        nodeVis.selected = true;
        nodeVis.color = 'red';
        nodes.update(nodeVis);

        // Remove any unselected nodes
        var nodesToRemove = [];
        $.each(nodes.get(), function(i, nodeOther) {
            if (!(nodeOther.selected)) {
                nodesToRemove.push(nodeOther.id);
            }
        });

        $.each(nodesToRemove, function(i, nodeId) {
            removeNode(nodeId);
        })

        $.get(nodeDataDict[id].links[0].href, function(nodeData, status) {
            addEdges(nodeData, true);
        });
    }
});

$.get("http://localhost:8080/graph/top", function(data, status) {
    addNode(data);
});
