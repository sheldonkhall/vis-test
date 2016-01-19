var nodeDataDict = {};  // lookup by href
var nodeVisDict = {};  // lookup by href

var edgeDict = {};

var nodes = new vis.DataSet([]);
var edges = new vis.DataSet([]);

var focusedId = null;
var loadStuff = false;

var colors = {
    data: {
        border: "#2B7CE9",
        background: "#97C2FC"
    },
    relation: {
        border: "black",
        background: "white"
    },
    constraint: {
        border: "black",
        background: "#ffaa00"
    },
    ontology: {
        border: "maroon",
        background: "#ef5555"
    },
    highlight: {
        border: "black"
    }
}


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
    physics: {
        solver: "forceAtlas2Based"
    }
};
var network = new vis.Network(container, vis_data, options);


// Functions on graph data
function getLabel(nodeData) {
    if (nodeData.value !== undefined) {
        return nodeData.value.substring(0, 50);
    } else if (
            nodeData.type === "CASTING" ||
            nodeData.type === "ASSERTION" ||
            nodeData.type.indexOf("CONSTRAINT") > -1) {
        return '{' + nodeData.isa + '}';
    } else if (nodeData.itemIdentifier !== undefined) {
        var split = nodeData.itemIdentifier.split(/[\/#]/);
        return split[split.length - 1];
    } else {
        return nodeData.type;
    }
}

function getColor(nodeData) {
    var color;

    if (nodeData.type === "CONCEPT_INSTANCE") {
        color = colors.data;
    } else if (nodeData.type === "CASTING" || nodeData.type === "ASSERTION") {
        color = colors.relation;
    } else if  (nodeData.type.indexOf("CONSTRAINT") > -1){
        color = colors.constraint;
    } else {
        color = colors.ontology;
    }

    return {
        border: color.border,
        background: color.background,
        highlight: {
            border: colors.highlight.border,
            background: color.background
        }
    };
}

function getShape(nodeData) {
    if (
        nodeData.type === "CONCEPT_INSTANCE" ||
        nodeData.type === "ASSERTION" ||
        nodeData.type === "CASTING"
    ) {
        return "ellipse";
    } else {
        return "box";
    }
}

function getHref(nodeData) {
    return nodeData.links[0].href;
}

function addNode(nodeData) {
    href = getHref(nodeData);
    if (!(href in nodeVisDict)) {
        // If this is a constraint, do nothing
        var showConstraints = $("#show-constraints").is(":checked");
        if (!showConstraints && nodeData.type.indexOf("CONSTRAINT") > -1) {
            return;
        }

        nodeVis = {
            id: nodeData.links[0].href,
            label: getLabel(nodeData),
            color: getColor(nodeData),
            selected: false,
            shape: getShape(nodeData)
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

    // Get only a few nodes if too many
    var inNodes = nodeData.in;
    if (nodeData.in.length > 50) {
        inNodes = _.sample(nodeData.in, 50);
    }

    $.each(inNodes, function(i, edge) {
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

function selectNode(nodeVis) {
    if (!nodeVis.selected && focusedId !== nodeVis.id) {
        // Select node
        nodeVis.selected = true;
        nodeVis.borderWidth = 3;
        nodeVis.color.border = colors.highlight.border;
        nodeVis.shadow = true;
        nodes.update(nodeVis);
    }
}

function expandNode(id) {
    selectNode(nodeVisDict[id]);

    if (focusedId !== id) {
        focusedId = id;
        removeUnselected();
    }

    // Pump out some more attached nodes
    $.get(getHref(nodeDataDict[id]), addEdges);
}

function loadRandomNode() {
    if (loadStuff) {
        // Select ALL nodes
        _.each(_.values(nodeVisDict), selectNode);

        var node = _.sample(_.values(nodeDataDict), 1)[0];
        expandNode(getHref(node));
        setTimeout(loadRandomNode, 1000);
    }
}


// Load concept-type initially
var prefix = "http://mindmaps.io/";
var conceptType = prefix + "concept-type";
var params = $.param({"itemIdentifier": conceptType});
$.get("http://localhost:8080/graph/concept/?" + params, addNode);

network.on("click", function (params) {
    if (params.nodes.length !== 0) {
        var id = params.nodes[0];
        var nodeVis = nodeVisDict[id];
        selectNode(nodeVis);
    }
});

network.on("doubleClick", function (params) {
    if (params.nodes.length === 0) {
        focusedId = null;
        removeUnselected();
    } else {
        var id = params.nodes[0];
        expandNode(id);
    }
});

// On right click
network.on("oncontext", function (params) {
    var id = network.getNodeAt(params.pointer.DOM);
    if (id !== undefined) {
        removeNode(id);
        if (focusedId === id) {
            focusedId = null;
            removeUnselected();
        }
    }
});

// Search by item identifier
$("#search-form").submit(function () {
    var params = $.param({"itemIdentifier": prefix + $("#search").val()});
    $.get("http://localhost:8080/graph/concept/?" + params, addNode);
    return false;
});

// Emergency override! Load everything, quick!!!
$("#load-all").click(function () {
    loadStuff = !loadStuff;
    loadRandomNode();
});

