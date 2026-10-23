const User = require('../models/User.model');
const { DEFAULTS } = require('../utils/notificationPolicy');
exports.getPreferences = async (req,res,next) => {
  try { const user = await User.findById(req.user._id).select('notification_preferences').lean(); return res.json({success:true,data:{...DEFAULTS,...user?.notification_preferences}}); } catch(error) {next(error);}
};
exports.updatePreferences = async (req,res,next) => {
  try {
    const update = {};
    for (const [key,value] of Object.entries(req.body || {})) {
      if (!Object.hasOwn(DEFAULTS,key) || typeof value !== 'boolean') return res.status(400).json({success:false,message:'Notification preferences must use supported boolean settings.'});
      update['notification_preferences.'+key]=value;
    }
    if (!Object.keys(update).length) return res.status(400).json({success:false,message:'No preferences supplied.'});
    const user = await User.findByIdAndUpdate(req.user._id,{$set:update},{returnDocument:'after',runValidators:true}).select('notification_preferences').lean();
    return res.json({success:true,data:{...DEFAULTS,...user.notification_preferences}});
  } catch(error) {next(error);}
};
