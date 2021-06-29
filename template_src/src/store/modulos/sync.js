import axios from 'axios';
import _ from 'lodash';
import swal from 'sweetalert';
const moment = require('moment');

const initialState = {
    sync: false,
    syncAll: false,
    syncExtra: {
        // prod: { load: false, url:'productos' },
    },
    update: moment().format('HH:mm [hrs] DD/MM/YYYY'),
    deviceready: false,
    deviceReadyListener: null,
    devicePlatform: 'iOS',
    deviceIos: true,
    syncError: 0,
    apiV: '3',
    version: '3.05.0',
    init: false,
};
const state = JSON.parse(JSON.stringify(initialState));

const getters = {   
    deviceready(state){return state.deviceready;},
    deviceIos(state){return state.deviceIos;},
    update(state){return state.update;},
    syncData: (state)=>(id)=>{return state.syncExtra[id] },
    loadSyncDataUrl: (state)=>(id)=>{return state.syncExtra[id].load },
    syncError(state){return state.syncError;},
    urlImagen: (state, getters) => (id) => {return `${getters.baseUrl}img/render/${id}/500/500/foto.jpg`},
    apiV(state){return state.apiV},
    vr(state){return state.version},
};

const mutations = {
    setData(state, [data]){
        this.commit('setSession', data);
        this.commit('initApirtc', data);
        this.commit('setVersion', data);
        this.commit('initStripeData',data);
        this.commit('setCatalogos', data);
        this.commit('setChats', data);
        
        //PERSONALIZADO
        this.commit('setUsuarioInfo', data);
        this.commit('setPacienteState', data);

        if(!state.deviceReadyListener){
            state.deviceReadyListener = true;
            document.addEventListener("deviceready", ()=>{

                console.log("============> DEVICE READY ");
                state.deviceready = true;
                state.devicePlatform = device.platform;
                state.deviceIos = state.devicePlatform == 'iOS';
                
                this.commit('addBackbutton_action');
                this.commit('initPushDeviceReady');
                this.dispatch('getLocalizacion');
            }, false);
        }
    },

    setExtraData(state, [data]){
        this.commit('setAfiliadoStateExrtra', data);
        this.commit('setNotificacionesData', data);
    },

    setSyncData(state, [id, data]){
        this.commit('setCatalogos', data);
    },

    initSync(state){
        state.sync = true;
    },
    initSyncAll(state){
        state.syncAll = true;
    },
    stopSync(state){
        state.sync = false;
        state.update = moment().format('HH:mm [hrs] DD/MM/YYYY');
    },
    stopSyncAll(state){
        state.syncAll = false;
    },
    
    initSyncData(state, id){
        state.syncExtra[id].load = true;
    },
    stopSyncData(state, id){
        state.syncExtra[id].load = false;
    },

    cleanSyncError(state){
        state.syncError = 0;
    },
    addSyncError(state){
        state.syncError += 1;
    },
    updateInit(state){
        state.init = true;
    }
};

const actions = {

    initData({state}, [f7]){
        this.dispatch('synchronizeData');
        this.commit('updateF7',[f7])
        this.commit('addBackbutton_action');
    },

    synchronizeData(state, force = false){
        this.dispatch('postGetSync',force);
        this.dispatch('postGetSyncData',force);
    },

    synchronizeDataCallback(state){
        this.dispatch('postGetSyncCallback',[true,()=>{
            swal("","Información actualizada","success");
        }]);
        // this.dispatch('postGetExtraSync');
    },

    scrollBottom({state}, cont){
        $(`#${cont}`).animate({ scrollTop: 9999 }, 'slow');
    },

    postGetSync({state}, force = false){
        if(!state.sync || force){
            this.commit('initSync');
            
            let data = {};
            this.dispatch('postPromiseSync', ['sync/get',data]).then(
                res => {
                    if(!state.init && this.getters.getSession.token){
                        this.commit('updateInit');
                        this.commit('closeModal',['loader']);
                    }
                    this.commit('cleanSyncError');
                    this.commit('stopSync');
                    this.commit('setData', [res.data]);
                    this.dispatch('getLocalizacion');
                },
                error=>{ 
                    this.commit('stopSync');
                    if(typeof error == 'object' && error.msg == 'Usuario inexistente'){
                        this.commit('logout');
                    }
                    if(error=='red'){
                        if(this.getters.syncError < 5){
                            this.commit('addSyncError');
                            this.dispatch('postGetSync');
                        }
                        else{
                            this.commit('closeModal',['loader']);
                            this.commit('cleanSyncError');
                            swal("Error de red","Por favor verifica que tengas acceso a internet","");
                        }
                    }
                   
            });
        }
    },
    
    postGetSyncCallback({state}, [force = false, callback = ()=>{}]){
        if(!state.sync || force){
            this.commit('initSync');
            let data = {};
            // console.log("sync",moment().format('HH:mm:ss'),this.getters.syncError);
            this.dispatch('postPromiseSync', ['sync/get',data]).then(
                res => {
                    this.commit('cleanSyncError');
                    this.commit('stopSync');
                    this.commit('setData', [res.data]);
                    callback();
                    this.dispatch('getLocalizacion');
                },
                error=>{ 
                    this.commit('stopSync');
                    if(typeof error == 'object' && error.msg == 'Usuario inexistente'){
                        this.commit('logout');
                    }
                    if(error=='red'){
                        if(this.getters.syncError < 5){
                            this.commit('addSyncError');
                            this.dispatch('postGetSync');
                        }
                        else{
                            this.commit('cleanSyncError');
                            swal("Error de red","Por favor verifica que tengas acceso a internet","");
                        }
                    }
                   
            });
        }
    },

    postGetExtraSync({state}){
        if(!state.syncProd){
            this.commit('initSyncAll');
            // console.log("all",moment().format('HH:mm:ss'));
            this.dispatch('postPromiseSync', ['sync/get_extra',{}]).then(
                res => {
                    this.commit('stopSyncAll');
                    this.commit('setExtraData', [res.data]);
                },
                error=>{ 
                    this.commit('stopSyncAll');
                    if(typeof error == 'object' && error.msg == 'Usuario inexistente'){
                        this.commit('logout');
                    }
            });
        }
    },

    postGetSyncData({state}){
        console.log("FOERCHING", state.syncExtra);
        for (const id in state.syncExtra) {
            this.dispatch('postGetSyncRow',id)
        }
    },

    postGetSyncRow({state}, id){
        if(this.getters.getSession.token){
            const x = this.getters.syncData(id);
            console.log("TREYINBG INDO",x);
            if(!this.getters.loadSyncDataUrl(id)){

                this.commit('initSyncData', id);
                this.dispatch('postPromiseSync', [`sync/${x.url}`,{}]).then(
                    res => {
                        this.commit('stopSyncData', id);
                        this.commit('setSyncData', [ id, res.data ]);
                    },
                    error=>{ 
                        this.commit('stopSyncData', id);
                        if(typeof error == 'object' && error.msg == 'Usuario inexistente'){
                            this.commit('logout');
                        }
                });
            }
        }
    },

    saveImagen({commit,state},foto){
        return this.dispatch('postPromiseLoaderImage',['sync/saveimg', {}, foto]);
    },
    
    postPromiseSync({state}, [url, data]){
        try{
            if(this.getters.getSession.token){
                data.token = this.getters.getSession.token;
            }

            if(this.getters.apiV){
                data.apiV = this.getters.apiV;
            }

            return new Promise((resolve, reject) => {
                this.commit('procesando');
                axios.post(this.getters.baseUrl + url, data,{ headers: { 'content-type' : 'text/plain' }, timeout: 30000 }).then(
                    response=>{   
                        this.commit('stop');
                        if(!response.data.status){
                            reject(response.data);
                            return;
                        }
                        resolve(response.data);
                    }).catch(
                    error => {
                        this.commit('stop');
                        reject('red');
                    });
            });
        }
        catch (e){
            console.error("ERROR",e);
            this.commit('stop');
        }
    },
};

export default {
    state,
    getters,
    mutations,
    actions
};