import PersonalInfo from "#models/personalInfo.js";
import catchAsync from "#utils/catchAsync.js";

export const getPersonalInfo = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    let personalInfo = await PersonalInfo.findOne({userId});

    if (!personalInfo) {
        personalInfo = new PersonalInfo({userId});
        await personalInfo.save();
    }

    res.json({success: true, personalInfo});
})

export const updatePersonalInfo = catchAsync(async (req, res, next) => {
    console.log(req.body.dob);
    const userId = req.user._id;

    const {firstName, lastName,profession, email, dob, bio, phone, address, github, linkedin} = req.body;

    const personalInfo = await PersonalInfo.findOneAndUpdate(
        {userId},
        {firstName, lastName,profession, email, dob, bio, phone, address, github, linkedin},
        {new: true, upsert: true,runValidators:true}
    );

    console.log(personalInfo);
    res.json({success: true, personalInfo});
});
