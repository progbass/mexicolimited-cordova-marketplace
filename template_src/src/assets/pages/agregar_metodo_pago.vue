<template>
    <f7-page id="inicio">
        <div class="vista">
            
        <nav-bar tipo="inicio" :backs="true" :title="'Nueva tarjeta'" :fix="1" />

            <div class=" contenedor-page-tabs ">

                <div class="row w-100 m-0 pt-4 px-3">
                    <div class="row w-100 m-0 px-3 letra-gray3-19 justify-content-center text-center ">
                    Los datos de tu tarjeta de credito o debito se almacenan de manera encriptada por medio de la tecnologia de STRIPE y no se comparten con ningún tercero.</div>
                </div>

                <div class="row w-100 m-0 mt-3 px-3">
                    <div class="row w-100 m-0 my-auto py-1 px-4">
                        <div class="col px-0">
                            <imagen :icono="true" src="visa" />
                        </div>
                        <div class="col px-0">
                            <imagen :icono="true" src="amex" />
                        </div>
                        <div class="col px-0">
                            <imagen :icono="true" src="mastercard" />
                        </div>
                    </div>
                    <div class="col-12 px-1 mt-3">
                        <inputForm :offset="500" type="number" texto="Numero de la tarjeta:" placeholder="" v-model="card.number" :maxlength="16"  />
                    </div>
                    <div class="col-6 px-1 mt-4">
                        <inputForm :offset="800" @focus="ex=1" @blur="ex=0" :date="true" type="month"  texto="Vigencia (mes/año):" placeholder="MM/YY" v-model="card.expiracion"  />
                    </div> 
                    <div class="col-6 px-1 mt-4">
                        <inputForm :offset="1000" @focus="ex=1" @blur="ex=0" type="number" texto="CVV" placeholder="***" v-model="card.cvv" maxlength="4"  />
                    </div>
                </div>

                <div class="row w-100 m-0 justify-content-center px-3 pt-5">
                    <div class="col-11 mx-auto px-0">
                        <boton-app @click="check()" texto="Agregar tarjeta" radius="35px"></boton-app>
                    </div>
                </div>

                <div class="row w-100 m-0 py-4"></div>
                <div class="row w-100 m-0 py-5 h-50vh " v-if="ex"></div>
            </div>
        </div>

    </f7-page>
</template>
<script>
import { f7Page } from 'framework7-vue';
const moment = require('moment');
    export default{
        components:{
            f7Page,
        },
        data(){
            return{
                ex: 0,
                card:{
                    number: '',
                    expiracion:'',
                    cvv: '',
                },
            } 
        },
        computed: {
            router(){ return this.$store.getters.getRouter;},
            deviceReady(){ return this.$store.getters.deviceready;},
            device(){ return typeof device == 'undefined' || device.platform == 'browser' },
        },
        methods:{
            check(){   
                if(this.device){
                    if(!this.card.expiracion){
                        this.card.expiracion = '2025-07';
                    }
                }
                
                if(!this.card.number || !this.card.expiracion || !this.card.cvv){
                    swal("Debe llenar todos los campos","","info");
                    return;
                }
                this.card.mes = moment(this.card.expiracion,'YYYY-MM').format('MM');
                this.card.year = moment(this.card.expiracion,'YYYY-MM').format('YYYY');
                console.log("CARD DATA", this.card);
                if(!this.device){
                    this.checarNumero();
                    //this.saveDebug();
                }
                else{
                    this.saveDebug();
                }
            },

            save(data){
                this.router.back();
            },
            
            checarNumero(){
                cordova.plugins.stripe.validateCardNumber(this.card.number, 
                (res)=>{
                    console.log("numero valido", res);
                    this.checarFecha();
                }, 
                (error)=>{
                    console.error("NUmero invalido", error);
                    swal("","El numero de la tarjeta es incorrecto", "error");
                });
            },

            checarFecha(){
                cordova.plugins.stripe.validateExpiryDate(this.card.mes, this.card.year, 
                (res)=>{
                    console.log("FECHA VALIDA", res);
                    this.checarCVC();
                }, 
                (error)=>{
                    console.error("FECHA INVALIDA", error);
                    swal( "","La fecha de expiración es incorrecta", "error");
                    return;
                });
            },

            checarCVC(){
                cordova.plugins.stripe.validateCVC(this.card.cvv,
                (res)=>{
                    console.log("CVC VALIDA", res);
                    this.createToken();
                }, 
                (error)=>{
                    console.error("CVC INVALIDA", error);
                    swal( "","El CVC es incorrecto", "error");
                    return;
                });
            },

            getBrand(){
                if(this.$store.getters.deviceready){
                    cordova.plugins.stripe.getCardType(this.card.number, function(cardType) {
                        console.log(cardType); // visa
                        return cardType;
                    });
                }
            },

            saveDebug(){
                let card = {
                    number: this.card.number,
                    expMonth: this.card.mes,
                    expYear: this.card.year,
                    cvc: this.card.cvv,
                    currency: 'MXN',
                };
                let data = {
                    ending: card.number.substr(card.number.length - 4),
                    brand: 'visa',
                    mes: card.expMonth,
                    year: card.expYear,
                    token_card: moment().format('X'),
                };
                this.save(data);
            },    

            createToken(){
                let card = {
                    number: this.card.number,
                    expMonth: this.card.mes,
                    expYear: this.card.year,
                    cvc: this.card.cvv,
                    currency: 'MXN',
                };
                try {
                    this.$store.commit('initLoader');
                    console.log("INTENT", card);
                    cordova.plugins.stripe.createCardToken(card,
                        result =>{
                            this.$store.commit('finishLoader');
                            card.ending = card.number.substr(card.number.length - 4);               
                            card.brand = (result.card.brand).toLowerCase();               
                            card.token_card = result.id;     
                            card.mes = card.expMonth;
                            card.year = card.expYear;
                            console.log("token para pago", result, card);   
                            this.save(card)                            
                        },
                        error=>{
                            this.$store.commit('finishLoader');
                            swal(error,"","error");
                        });
                }
                catch(error){
                    this.$store.commit('finishLoader');
                    swal("Error de red: revise su conexion", "", "error");                   
                }
            },      
            save(data){
                this.$store.dispatch('postAddMetodoPago', data);
            },          
        }
    }
</script>