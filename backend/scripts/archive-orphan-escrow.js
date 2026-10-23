'use strict';
require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
const {MongoClient,ObjectId}=require('mongoose').mongo;
const {archiveOrphanEscrow}=require('../services/escrowReconciliation.service');
(async()=>{
 const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
 try{
  await client.connect();const db=client.db(),id=new ObjectId('6a7b3d8a34044c2e4684a051');
  if(!process.argv.includes('--apply')){const record=await db.collection('escrows').findOne({_id:id});console.log(JSON.stringify({mode:'dry-run',escrowId:String(id),exists:!!record,amount:record?.amount,walletTransfer:0}));return;}
  const session=client.startSession();try{let result;await session.withTransaction(async()=>{result=await archiveOrphanEscrow(db,id,session)});console.log(JSON.stringify(result));}finally{await session.endSession();}
 }finally{await client.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1});
