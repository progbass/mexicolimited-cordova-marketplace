import axios from 'axios';
import swal from 'sweetalert';
const moment = require('moment');

const initialState = {
    producto: null,
    domicilios:{a:[]},

    domicilio: null,
    metodo_pago: null,
    para_usuarios_id: null,
    listas_id: null,
    eventos_id: null,
    
    desgloce: {
        carrito : [],
        restaurantes_id: null,
        cambio: 0,
        costoEnvio: 0,
        ivaEnvio: 0,
        subtotal: 0,
        comision: 0,
        iva: 0,
        total: 0,
    },

    servicioQR: {},
};

const state=JSON.parse(JSON.stringify(initialState));

const getters={
    carritoObject:(state)=>(obj)=>{return state[obj]},
    carritoArray:(state)=>(obj)=>{return state[obj].a},
    carritoFind:(state)=>(obj,data)=>{return state[obj].a.find(a=>{return a.id == state[data]}) || {}},
    carritoFindInside:(state)=>(obj,data,key,id)=>{return state[obj].a.find(a=>{return a.id == state[data]})[key].find(x=>{return x.id == state[id]})},
};
const mutations={

    setCarritosState(state,[key,data]){
        state[key] = data;
    },

    updateCarritosState(state,data){
        if(data.domicilios){
            state.domicilios = {a: data.domicilios};
            if(!state.domicilio){
                state.domicilio = (data.domicilios.find(x=>{return true;}) || {}).id || null;
                if(state.domicilio){
                    this.dispatch('synchronizeData');
                }
            }
        }
    },

    initMetodoPago(state, metodos){
        if(!state.metodo_pago){
            let m = metodos.find(x=>{return true});
            if(m){
                state.metodo_pago = m.id;
            }
        }
    },

    addProductoCarrito(state, prod){
        console.log("producto", prod);
        if(!prod.cantidad){
            prod.cantidad = 1;
        }
        state.desgloce.carrito.push(prod);
        this.commit('calcularTotal');
    },

    removeProductoCarrito(state, prod){
        console.log("producto", prod);
        let index = state.desgloce.carrito.findIndex(x=>{return x.id == prod.id});
        if(index != -1){
            state.desgloce.carrito.splice(index, 1);
        }
        this.commit('calcularTotal');
    },

    calcularTotal(state){
        state.desgloce.subtotal = 0;
        state.desgloce.comision = 0;
        state.desgloce.total = 0;
        state.desgloce.costoEnvio = 0;
        state.desgloce.cambio = this.getters.catalogoGetObject('cambioUSD');
        state.desgloce.cambioIva = this.getters.catalogoGetObject('cambioIva');

        state.desgloce.carrito.map(x=>{
            if(x.currency == 'USD'){
                state.desgloce.subtotal = state.desgloce.subtotal + ( Number(x.precio) * Number(x.cantidad) * Number(state.desgloce.cambio) ) ;
            }
            else{
                state.desgloce.subtotal = state.desgloce.subtotal + ((Number(x.precio) * Number(x.cantidad)) );
            }
            state.desgloce.costoEnvio = state.desgloce.costoEnvio + Number(x.shipping_cost);
        });

        if( state.desgloce.carrito.filter(x=>{return x.type == 'coopera'}).length == state.desgloce.carrito.length ){
            state.desgloce.costoEnvio = 0;
        }

        if( state.desgloce.carrito.every(x=>{return x.product_type == '2'}) ){
            state.desgloce.costoEnvio = 0;
        }

        state.desgloce.comision = state.desgloce.subtotal * 0;
        state.desgloce.iva = state.desgloce.subtotal * state.desgloce.cambioIva;
        state.desgloce.ivaEnvio = state.desgloce.costoEnvio * state.desgloce.cambioIva;
        state.desgloce.total = (state.desgloce.subtotal + state.desgloce.iva) + (state.desgloce.costoEnvio + state.desgloce.ivaEnvio);
        console.log("TOTALS ", state.desgloce.subtotal, state.desgloce.iva, state.desgloce.costoEnvio, state.desgloce.ivaEnvio, state.desgloce.total );
        state.desgloce = JSON.parse(JSON.stringify(state.desgloce));
    },
    
    cleanCarrito(state){
        state.desgloce = { 
            carrito : [],
            restaurantes_id: null,
            cambio: 0,
            costoEnvio: 0,
            ivaEnvio: 0,
            subtotal: 0,
            comision: 0,
            iva: 0,
            total: 0,
        };
    }
};

const actions={

    postCrearPedido({ commit, state },[qr]){
        let data = {
            carrito: state.desgloce,
            qr: qr,
            domicilio: this.getters.carritoFind('domicilios','domicilio'),
            metodo: state.metodo_pago,
            para_usuarios_id: state.para_usuarios_id,
            listas_id: state.listas_id,
        };

        // if(!data.domicilio || !data.domicilio.id){
        //     swal("","Hubo un error con el domicilio","");
        //     return;
        // }
        
        if( !state.metodo_pago ){
            swal("","Selecciona un metodo de pago","");
            return;
        }

        let finish = (res)=>{
            this.dispatch('synchronizeData');
            this.dispatch('sendDataAllUsers',[{servicio:true}]);
            this.getters.getRouter.navigate('/historial_compras');
            this.commit('cleanCarrito');
            this.commit('openMsn',['¡Listo!\nTu pedido ha sido realizado con éxito.\nPuedes verlo en tu cuenta','Ok',true,false]);
        };

        this.dispatch('postPromiseLoader', ['pedidos/crear_new', data]).then(
        res => {
            finish(res);
        },error=>{});
    },

    postSaveDireccion({ commit, state }, form){
        let data = {
            data: form,
        };

        let finish = (res)=>{
            this.dispatch('synchronizeData');
            this.dispatch('sendDataAllUsers',[{servicio:true}]);
            this.getters.getRouter.back();
            swal("","Domicilio agregado","success");
        };

        this.dispatch('postPromiseLoader', ['datos/add_domicilio', data]).then(
        res => {
            finish(res);
        },error=>{});
    },

    postEliminarProductoLista({ commit, state }, form){
        let data = {
            producto: form,
        };
        let finish = (res)=>{
            this.dispatch('synchronizeData');
            swal("","Producto eliminado","success");
        };
        this.dispatch('postPromiseLoader', ['fechas/eliminar_producto_fecha', data]).then(
        res => {
            finish(res);
        },error=>{});
    },

    postEliminarDireccion({ commit, state }, form){
        let data = {
            domicilios_id: form.id,
        };

        let finish = (res)=>{
            this.dispatch('synchronizeData');
            this.dispatch('sendDataAllUsers',[{servicio:true}]);
            swal("","Domicilio eliminado","success");
        };

        this.dispatch('postPromiseLoader', ['datos/remove_domicilio', data]).then(
        res => {
            finish(res);
        },error=>{});
    },

    postAgregarProductoLista({ commit, state }, lista){
        let data = {
            productos_id: state.producto,
            lista: lista,
            
        };

        let finish = (res)=>{
            this.dispatch('synchronizeData');
            this.dispatch('sendDataAllUsers',[{servicio:true}]);
            swal("","Producto agregado a la lista","success");
            this.getters.getRouter.back('/detalle_producto');
        };

        this.dispatch('postPromiseLoader', ['fechas/create_producto', data] ).then(
        res => {
            finish(res);
        },error=>{});
    },

    postAgregarProductoListaByID({ commit, state }, [lista, prod]){
        let data = {
            productos_id: state.producto,
            lista: lista,
            fecha: this.getters.userStateObject('lista'),
            regalos: [prod],
        };

        let finish = (res)=>{
            this.dispatch('synchronizeData');
            this.dispatch('sendDataAllUsers',[{servicio:true}]);
            swal("","Producto agregado a la lista","success");
            this.getters.getRouter.back('/mis_deseos',{force: true});
        };

        console.log("tipo",this.getters.userStateObject('tipo'));
        // this.dispatch('postPromiseLoader', ['fechas/create_producto', data]).then(
        this.dispatch('postPromiseLoader', [(this.getters.userStateObject('tipo')=='agregarRegaloFecha')?'fechas/agregar_regalos_fechas':'fechas/create_producto', data]).then(
        res => {
            finish(res);
        },error=>{});
    },

    postCarritoGetServicio({ commit, state }, [ code ]){
        let data = {
            code: code,
        };

        let finish = (res)=>{
            this.commit('setCarritosState',[ 'servicioQR', res.data.servicio ]);
            this.dispatch('synchronizeData');
            this.getters.getRouterView('usuario').navigate('/detalle_servicio_qr');
            this.commit('cerrarEscaner');

        };

        this.dispatch('postPromiseLoader', ['datos/get_servicio_producto', data]).then(
        res => {
            finish(res);
        },error=>{});
    },

};

export default {
    state,
    getters,
    mutations,
    actions
};