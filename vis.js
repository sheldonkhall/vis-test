function getLabel(nodeData) {
    if (nodeData.value !== undefined) {
        return nodeData.value;
    } else if (nodeData.itemIdentifier !== undefined) {
        var split = nodeData.itemIdentifier.split(/[\/#]/);
        return split[split.length - 1];
    } else {
        return nodeData.type;
    }
}

function getHref(nodeData) {
    return nodeData.links[0].href;
}

var nodeDataDict = {};  // lookup by href
var nodeVisDict = {};  // lookup by href

var edgeDict = {};

var nodes = new vis.DataSet([]);
var edges = new vis.DataSet([]);

var focusedId = null;

// create a network
var container = document.getElementById('mynetwork');

var vis_data  = {
    nodes: nodes,
    edges: edges
};
var options = {
    edges: {
        arrows: {
            to: true
        }
    },
    interaction: {
        hover: true
    },
    physics: {
        solver: "forceAtlas2Based"
    }
};

var network = new vis.Network(container, vis_data, options);

function addNode(nodeData) {
    href = getHref(nodeData);
    if (!(href in nodeVisDict)) {
        // If this is a constraint, do nothing
        if (nodeData.type.indexOf("CONSTRAINT") > -1) {
            return;
        }

        nodeVis = {
            id: nodeData.links[0].href,
            label: getLabel(nodeData),
            selected: false
        };

        nodeVisDict[href] = nodeVis;
        nodeDataDict[href] = nodeData;
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
        addEdge(getHref(edge.source), getHref(edge.target), edge.type);
    });

    $.each(nodeData.in, function(i, edge) {
        addNode(edge.source);
        addNode(edge.target);
        addEdge(getHref(edge.source), getHref(edge.target), edge.type);
    });
}

function removeUnselected() {
    var nodesToRemove = [];
    $.each(nodes.get(), function(i, nodeVis) {
        if (!(nodeVis.selected)) {
            nodesToRemove.push(nodeVis.id);
        }
    });

    $.each(nodesToRemove, function(i, nodeId) {
        removeNode(nodeId);
    })
}

network.on("click", function (params) {
    if (params.nodes.length === 0) {
        focusedId = null;
        removeUnselected();
    } else {
        var id = params.nodes[0];

        var nodeVis = nodeVisDict[id];

        if (focusedId === id) {
            // Unselect focused node
            focusedId = null;
            nodeVis.selected = false;
            nodes.update(nodeVis);

            removeUnselected();
        } else {
            // Select node
            focusedId = nodeVis.id;
            nodeVis.selected = true;
            nodeVis.color = 'red';
            nodes.update(nodeVis);

            removeUnselected();

            $.get(getHref(nodeDataDict[id]), function(nodeData, status) {
                addEdges(nodeData, true);
            });
        }
    }
});

var conceptType = "http://mindmaps.io/concept-type";
var params = $.param({"itemIdentifier": conceptType});

$.get("http://localhost:8080/graph/concept/?" + params, addNode);
