'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');
const Settings = require('../models/PlatformSettings.model');
const AuditLog = require('../models/AuditLog.model');
exports.getPolicy = async (req,res,next) => {
  try { const settings=await Settings.getSettings();res.set('Cache-Control','no-store').json({success:true,data:settings.withdrawal_automation}); } catch(error){next(error);}
};
exports.setPolicy = async (req,res,next) => {
  if(typeof req.body?.enabled !== 'boolean') return res.status(400).json({success:false,message:'Supply an enabled boolean.'});
  const session=await mongoose.startSession();let policy;
  try {
    await session.withTransaction(async()=>{
      const settings=await Settings.getSettings(session),before=settings.withdrawal_automation?.toObject?.() || {};
      if(Boolean(before.enabled)===req.body.enabled){policy=before;return;}
      settings.withdrawal_automation=req.body.enabled?{enabled:true,activated_at:new Date(),activated_by:req.user._id,epoch:crypto.randomUUID()}:{...before,enabled:false};
      await settings.save({session});policy=settings.withdrawal_automation.toObject();
      await AuditLog.create([{user_id:req.user._id,action:'withdrawal_automation_changed',target_type:'PlatformSettings',target_id:settings._id,changes:{old:before,new:policy}}],{session});
    });
    res.json({success:true,data:policy});
  }catch(error){next(error);}finally{await session.endSession();}
};
