// route information sidebar

function routeinfopanel(routes) {
    var panel = document.getElementById("routename");
    var rdiv = document.createElement('div');
    rdiv.setAttribute("class", "btn-group");
    rdiv.setAttribute("data-toggle", "buttons");
    panel.appendChild(rdiv);
    c = 0;
    //sorting the routes
    var route_names_dict = {};

    var route_names = [];

    _(routes).each(function(r) {
        route_names_dict[r.name] = r.id;
        route_names.push(r.name);
    });

    var sorted_obj = {};

    route_names.sort();
    // debugger;
    _(route_names).each(function(rn) {
        // sorted_obj[rn] = route_names_dict[rn];
        routeid = route_names_dict[rn];
        r = routes[routeid];
        // console.log("%s,%s",r.name,r.id);
        var button = document.createElement('input');
        button.type = 'radio';
        button.name = 'options';
        button.id = routeid;
        // button.id = c++; //make this the routes' id
        button.setAttribute("onclick", "YY.single_route_render(system,system.routeDict[this.id])");
        // button.setAttribute("data-toggle","button");
        var label = document.createElement('label');
        label.setAttribute("class", "btn btn-default");
        label.innerHTML = r.name;
        label.appendChild(button);
        rdiv.appendChild(label);
    })
}