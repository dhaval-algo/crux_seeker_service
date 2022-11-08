
// all the meta information constants are defined below 
const EXTRA_KEYWORDS_LEARN_CONTENT_LIST = ["online courses", "learning courses", "paid courses", "degrees", "certifications", "offline courses", "instructor courses", "courses near me", "top courses"];
const EXTRA_KEYWORDS_PROVIDER = ['top institutes', 'indian institutes', 'free courses', 'online courses', 'top institutes', 'careervira institutes', 'institutes near me', 'free online courses', 'learning', 'list of institutes', 'top universities', 'universities'];
const EXTRA_KEYWORDS_PARTNER = ["free courses", "online courses", "courses near me", "careervira courses", "available courses", "self paced/instructors", "english courses", "degrees", "certifications"];
const EXTRA_KEYWORDS_PROVIDER_LIST = ["courses", "free courses", "online courses", "courses near me", "careervira courses", "available courses", "self paced/instructors", "english courses", "degrees", "certifications"];
const DESCRIPTION_PROVIDER_LIST = "Discover Highly Vetted and Curated online courses, executive education, boot camp, degrees, and certifications for professionals. Get a detailed analysis and ranking of the courses and programs from the top global institutions. Make better learning and career decisions.";
const TITLE_PROVIDER_LIST = "List of institutes offering over 10000+ courses | Careervira | Careervira.com"
const TITLE_ARTICLE_LIST = `Advice by Careervira | Get advice from top professionals, experts and learners  | ${process.env.SITE_URL_FOR_META_DATA}`;
const DESCRIPTION_ARTICLE_LIST = `You can get expert advice with Careervira.com’s personalised career services. Get advice from top professionals, industry experts, academics and learners on career guide, learn path and how to master a subject. You can navigate through your career path to reach your target role based on your skill assessment`
const EXTRA_KEYWORDS_ARTICLE_LIST = ["careervira advice", "online marketplace", "learn content", "courses near me", "careervira courses", "careervira articles", "free articles", "learning advice", "institute advice", "ranking articles", "ranking advice", "career advice", "career path", "top courses", "experts", "top professionals", "industry experts", "careervira content", "institutes", "degrees", "certifications"];
const EXTRA_KEYWORDS_ARTICLE = ["careervira advice", "online marketplace", "learn content", "courses near me", "courses near me", "careervira articles", "english courses", "free articles", "learning advice", "institute advice", "ranking articles", "ranking advice", "career advice", "career path", "top courses", "experts", "top professionals", "industry experts", "careervira content", "institutes", "degrees", "certifications", "courses"];
const DEFAULT_CALL_FOR_ACTION = 'Visit us at Careervira.'
const defaultLearnContentMetaInfo = {
    meta_description: "Find top courses, degrees and certifications here. See our comprehensive collection of management, software, finance and big data courses from top Institutes and Partners like Pluralsight, Coursera, Edureka, Simpliv LLC and many more. Start learning now. Search and compare courses before you buy.",
    meta_title: "List of over 10000 courses , degrees and certifications from top institutes and providers | Careervira | Careervira.com",
    meta_keywords: "online courses, learning courses, paid courses, degrees, certifications, offline courses, instructor courses, courses near me, top courses"
};

const getPartnerMetaDescription = (partnerName) => {

    return `Careervira has courses from top institutes and learning partners like ${partnerName}. Select the best course, degree or certifications for you from our learning platform.`;
}

const getPartnerMetaTitle = (partnerName) => {

    return `${partnerName} | Top partners from Careervira`
}
const countCheck = (format) => {
    let counter = 0;
    for (let i = 0; i < format.length; i++) {
        if (format[i] != ' ') {
            counter++;
        }
    }
    return counter;
}
const generateCourseMetaDescription = async (result) => {
    try {
        const actions = {
            "subscribe_now": " Subscribe Now!",
            "want_more_information": " Want more information? Call Us Now.",
            "visit_us_at_careervira": " Visit us at Careervira.",
            "join_us_now": " Join Us Now!",
            "click_here_for_details": " Click here for details.",
            "enroll_now": " Enroll Now!"
        }
        const max_char_count = 160
        let format = result.meta_description
        const title = result.title
        const learn_type = result.learn_type
        let partner = (result.partner.name) ? result.partner.name : ''
        const skills = result.skill_tags
        const action = result.call_for_action

        if (result.coupons && result.coupons.length > 0) {
            let coupons_str = 'Get '
            let coupons = result.coupons.map(coupon => coupon.coupon_name)
            coupons_str = coupons_str + coupons.join(', ');
            format = format.replace(/{coupon}/g, coupons_str + ' on')
            format = format.replace(/{title}/g, title)
        }
        else {
            format = format.replace(/{coupon}/g, 'Learn')
            format = format.replace(/{title}/g, title)
        }
        if (result.learn_type) {
            format = format.replace(/{learn_type}/g, learn_type)
        }
        else {
            format = format.replace(/{learn_type}/g, '')
        }
        format = format.replace(/{partner_name}/g, partner)
        if (result.call_for_action) {
            format = format.replace(/{call_for_action}/g, actions[action])
        } else {
            format = format.replace(/{call_for_action}/g, '')
        }
        let skill_string = "";
        if (skills && skills.length > 0) {
            skill_string += " like ";
            for (let skill of skills) {
                skill_string = skill_string + skill + ",";
            }
            skill_string = skill_string.slice(0, -1);
            skill_string += " etc"
        }

        format = format.replace(/{skills}/g, skill_string)

        let count = countCheck(format);
        if (count > max_char_count) {
            if (result.call_for_action) {
                let re = new RegExp(actions[action], "g");
                format = format.replace(re, '')
            }
        }
        if (skills && skills.length > 0) {
            for (let i = skills.length - 1; i >= 0; i--) {
                if(!skills[i].includes("/"))
                {
                    let re = new RegExp("," + skills[i], "g");
                    let recount = countCheck(format);
                    if (recount > max_char_count) {
                        format = format.replace(re, '')
                    } else {
                        break
                    }
                }
            }
        }

        return format;
    } catch (err) {
        console.log("err in meta description", err)
        return result.meta_description
    }
}

const generateCourseMetaKeywords = async (result) => {
    try {
        let format = result.meta_keywords
        const skills = result.skill_tags
        const topics = (result.topics_list && result.topics_list.length > 0) ? result.topics_list.map(topic => topic.default_display_label) : []
        let name = result.title
        let partner_name = result.partner.name
        let course_partner_name = [];
        if (name.includes(partner_name)) {
            course_partner_name.push(name);
        } else {
            if ((name.split(" ").length + partner_name.split(" ").length) > 6) {
                course_partner_name.push(partner_name + " " + name);
            } else {
                course_partner_name.push(name + " by " + partner_name);
            }
        }
        let topic_learn_type = [];
        if (result.learn_type) {
            for (let i of topics) {
                topic_learn_type.push(i + " " + result.learn_type);
            }
        }
        let medium_topic_name = [];
        if (result.medium) {
            for (let i of topics) {
                medium_topic_name.push(result.medium + " " + i + " course")
            }
        }

        let payment_medium = [];
        if (result.pricing_type == 'Free') {
            if (result.medium) {
                payment_medium.push("Free " + result.medium)
            }
        }

        let payment_topic = [];
        if (result.pricing_type == 'Free') {
            for (let i of topics) {
                payment_topic.push("Free " + i + " Course")
            }
        }
        if (skills && skills.length > 0) {
            format = format.replace(/{skills}/g, skills.join(", "))
        } else {
            format = format.replace(/{skills}, /g, '')
        }
        if (topics.length > 0) {
            format = format.replace(/{topic}/g, topics.join(", "))
        } else {
            format = format.replace(/{topic}, /g, '')
        }
        if (course_partner_name.length > 0) {
            format = format.replace(/{course_name_by_partner_name}/g, course_partner_name.join(", "))
        } else {
            format = format.replace(/{course_name_by_partner_name}, /g, '')
        }
        if (topic_learn_type.length > 0) {
            format = format.replace(/{topic_and_learn_type}/g, topic_learn_type.join(", "))
        } else {
            format = format.replace(/{topic_and_learn_type}, /g, '')
        }
        if (medium_topic_name.length > 0) {
            format = format.replace(/{medium_and_topic_name}/g, medium_topic_name.join(", "))
        } else {
            format = format.replace(/{medium_and_topic_name}, /g, '')
        }
        if (payment_medium.length > 0) {
            format = format.replace(/{payment_and_medium}/g, payment_medium.join(", "))
        } else {
            format = format.replace(/{payment_and_medium}, /g, '')
        }
        if (payment_topic.length > 0) {
            format = format.replace(/{payment_and_topic}/g, payment_topic.join(", "))
        } else {
            format = format.replace(/{payment_and_topic}/g, '')
        }

        return format;
    } catch (err) {
        console.log("err in meta keywords", err)
    }
}

const getLearnContentListMetaInfo = (result) => {

    let meta_description = null;
    let meta_keywords = '';
    let meta_title = null;

    if (result.page_details.pageType == 'category' || result.page_details.pageType == 'sub_category' || result.page_details.pageType == 'topic') {
        meta_title = `Top ${result.page_details.label} Courses in ${new Date().getFullYear()} | Careervira`;
        meta_description = (result.meta_information) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description
        meta_keywords = (result.meta_information) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
        let learn_type = []
        for (let filter of result.filters) {
            if (filter.field == 'learn_type') {
                if (filter.options && filter.options.length > 0) {
                    filter.options.map(option => { learn_type.push(option.label) }
                    )
                }
            }

        }

        let partners = []

        for (let filter of result.filters) {
            if (filter.field == 'partner_name') {
                if (filter.options && filter.options.length > 0) {
                    filter.options.map(option => { partners.push(option.label) }
                    )
                }
            }

        }
        let skills = []

        for (let filter of result.filters) {
            if (filter.field == 'skills') {
                if (filter.options && filter.options.length > 0) {
                    filter.options.map(option => { skills.push(option.label) }
                    )
                }
            }

        }
        let mediums = []
        for (let filter of result.filters) {
            if (filter.field == 'medium') {
                if (filter.options && filter.options.length > 0) {
                    filter.options.map(option => { mediums.push(option.label) }
                    )
                }
            }

        }
        let pricing_types = []
        for (let filter of result.filters) {
            if (filter.field == 'pricing_type') {
                if (filter.options && filter.options.length > 0) {
                    filter.options.map(option => { pricing_types.push(option.label) }
                    )
                }
            }

        }

        if (result.page_details.pageType == 'category') {
            meta_description = meta_description.replace(/{category}/g, result.page_details.label)
            meta_description = meta_description.replace(/{partners}/g, partners.slice(0, 5).join(', '))
            meta_description = meta_description.replace(/{call_for_action}/g, DEFAULT_CALL_FOR_ACTION)

            meta_keywords = meta_keywords.replace(/{category}/g, `${result.page_details.label},`)
            if (learn_type.length > 0) {
                let category_and_learn_type = learn_type.map(item => `${result.page_details.label} ${item} courses`)
                meta_keywords = meta_keywords.replace(/{category_and_learn_type}/g, category_and_learn_type.join(', ') + ',')
            }
            else {
                meta_keywords = meta_keywords.replace(/{category_and_learn_type}/g, '')
            }

            if (mediums.length > 0) {
                let category_and_medium = mediums.map(item => `${item} ${result.page_details.label} courses`)
                meta_keywords = meta_keywords.replace(/{medium_and_category_name}/g, category_and_medium.join(', ') + ',')

                if (pricing_types.includes("Free")) {
                    let payment_and_medium = mediums.map(item => `FREE ${item} courses`)
                    meta_keywords = meta_keywords.replace(/{payment_and_medium}/g, payment_and_medium.join(', ') + ',')
                }
            }
            else {
                meta_keywords = meta_keywords.replace(/{medium_and_category_name}/g, '')
                meta_keywords = meta_keywords.replace(/{payment_and_medium}/g, '')
            }

            if (pricing_types.includes("Free")) {
                meta_keywords = meta_keywords.replace(/{payment_and_category}/g, `FREE ${result.page_details.label} courses,`)
            }
            else {
                meta_keywords = meta_keywords.replace(/{payment_and_category}/g, '')
            }

        }
        if (result.page_details.pageType == 'sub_category') {
            meta_description = meta_description.replace(/{sub_category}/g, result.page_details.label)
            meta_description = meta_description.replace(/{call_for_action}/g, DEFAULT_CALL_FOR_ACTION)
            meta_keywords = meta_keywords.replace(/{sub_category}/g, `${result.page_details.label},`)

            if (learn_type.length > 0) {
                let sub_category_and_learn_type = learn_type.map(item => `${result.page_details.label} ${item} courses`)
                meta_keywords = meta_keywords.replace(/{sub_category_and_learn_type}/g, sub_category_and_learn_type.join(', ') + ',')
            }
            else {
                meta_keywords = meta_keywords.replace(/{sub_category_and_learn_type}/g, '')
            }

            if (mediums.length > 0) {
                let medium_and_sub_category_name = mediums.map(item => `${item} ${result.page_details.label} courses`)
                meta_keywords = meta_keywords.replace(/{medium_and_sub_category_name}/g, medium_and_sub_category_name.join(', ') + ',')

                if (pricing_types.includes("Free")) {
                    let payment_and_medium = mediums.map(item => `FREE ${item} courses`)
                    meta_keywords = meta_keywords.replace(/{payment_and_medium}/g, payment_and_medium.join(', ') + ',')
                }
            }
            else {
                meta_keywords = meta_keywords.replace(/{medium_and_sub_category_name}/g, '')
                meta_keywords = meta_keywords.replace(/{payment_and_medium}/g, '')
            }

            if (pricing_types.includes("Free")) {
                meta_keywords = meta_keywords.replace(/{payment_and_sub_category}/g, `FREE ${result.page_details.label} courses,`)
            }
            else {
                meta_keywords = meta_keywords.replace(/{payment_and_sub_category}/g, '')
            }

        }
        if (result.page_details.pageType == 'topic') {
            meta_description = meta_description.replace(/{topic}/g, result.page_details.label)
            if (learn_type.length > 0) {
                meta_description = meta_description.replace(/{learn_type}/g, learn_type.slice(0, 5).join(', '))
            }
            else {
                meta_description = meta_description.replace(/{learn_type}/g, '')
            }
            meta_description = meta_description.replace(/{call_for_action}/g, DEFAULT_CALL_FOR_ACTION)
            meta_keywords = meta_keywords.replace(/{topic}/g, `${result.page_details.label},`)

            if (learn_type.length > 0) {
                let topic_and_learn_type = learn_type.map(item => `${result.page_details.label} ${item} courses`)
                meta_keywords = meta_keywords.replace(/{topic_and_learn_type}/g, topic_and_learn_type.join(', ') + ',')
            }
            else {
                meta_keywords = meta_keywords.replace(/{topic_and_learn_type}/g, '')
            }

            if (mediums.length > 0) {
                let medium_and_topic_name = mediums.map(item => `${item} ${result.page_details.label} courses`)
                meta_keywords = meta_keywords.replace(/{medium_and_topic_name}/g, medium_and_topic_name.join(', ') + ',')

                if (pricing_types.includes("Free")) {
                    let payment_and_medium = mediums.map(item => `FREE ${item} courses`)
                    meta_keywords = meta_keywords.replace(/{payment_and_medium}/g, payment_and_medium.join(', ') + ',')
                }
            }
            else {
                meta_keywords = meta_keywords.replace(/{medium_and_topic_name}/g, '')
                meta_keywords = meta_keywords.replace(/{payment_and_medium}/g, '')
            }

            if (pricing_types.includes("Free")) {
                meta_keywords = meta_keywords.replace(/{payment_and_topic}/g, `FREE ${result.page_details.label} courses,`)
            }
            else {
                meta_keywords = meta_keywords.replace(/{payment_and_topic}/g, '')
            }
        }

        if (skills.length > 0) {
            meta_keywords = meta_keywords.replace(/{skills}/g, learn_type.slice(0, 5).join(', '))
        }
        else {
            meta_keywords = meta_keywords.replace(/{skills}/g, '')
        }
        return { meta_title: meta_title, meta_description: meta_description, meta_keywords: meta_keywords };

    }
    else {
        return defaultLearnContentMetaInfo
    }





}



const getProviderMetaInfo = (result) => {

    let meta_title = '';
    let meta_description = '';
    let meta_keywords = [];


    meta_title = `${result.name} | ${result.city}`;
    let location = result.city;
    if (result.country) {
        meta_title += `, ${result.country}`
        location += `, ${result.country}`
    }
    let course_count = (result.course_count) ? result.course_count : 0
    let program_names_str = null;
    let study_modes_names_str = null;
    if (result.programs) {
        program_names_str = result.programs.join(", ");
    }
    if (result.study_modes) {
        study_modes_names_str = result.study_modes.join(", ");
    }
    if (!result.meta_description) {
        meta_description = `${result.name}, ${location} has over ${course_count} courses.`;
        if (program_names_str && study_modes_names_str) {
            meta_description += ` It offers ${program_names_str} and ${study_modes_names_str}`;
        }
        else if (program_names_str) {
            meta_description += ` It offers ${program_names_str}`;
        }
        else if (study_modes_names_str) {
            meta_description += ` It offers ${study_modes_names_str}`;
        }
        meta_description += `. `;
    } else {

        meta_description = result.meta_description;
        meta_description = meta_description.replace(/{name}/g, result.name)
        meta_description = meta_description.replace(/{location}/g, location)
        meta_description = meta_description.replace(/{courses_count}/g, course_count)
        if (program_names_str && study_modes_names_str) {
            meta_description = meta_description.replace(/{program_names_and_study_modes}/g, `${program_names_str} and ${study_modes_names_str} courses`)
        }
        else if (program_names_str) {
            meta_description = meta_description.replace(/{program_names_and_study_modes}/g, program_names_str + ' courses')
        }
        else if (study_modes_names_str) {
            meta_description = meta_description.replace(/{program_names_and_study_modes}/g, study_modes_names_str + ' courses')
        }
    }


    if (result.meta_keywords) {
        meta_keywords = result.meta_keywords;
        meta_keywords = meta_keywords.replace(/{name}/g, result.name)
        meta_keywords = meta_keywords.replace(/{programs}/g, program_names_str)
        meta_keywords = meta_keywords.replace(/{study_modes}/g, study_modes_names_str)
        meta_keywords = meta_keywords.replace(/{location}/g, location)
        meta_keywords = meta_keywords.replace(/{extra_keywords}/g, EXTRA_KEYWORDS_PROVIDER.join(", "))
    }
    else {
        meta_keywords = [result.name];

        meta_keywords = [...meta_keywords, ...EXTRA_KEYWORDS_PROVIDER];
        meta_keywords.push(location);
        meta_keywords = [...meta_keywords, ...result.programs, ...result.study_modes];
        if (meta_keywords.length > 0) {
            meta_keywords = [...new Set(meta_keywords)];
            meta_keywords = meta_keywords.join(", ");
        }
    }

    return {
        meta_title: meta_title,
        meta_description: meta_description,
        meta_keywords: meta_keywords,
        student_educational_background_diversity: result.student_educational_background_diversity,
        student_nationality_diversity: result.student_nationality_diversity,
        student_gender_diversity: result.student_gender_diversity,
        student_avg_experience_diversity: result.student_avg_experience_diversity,
        highest_package_offered: result.highest_package_offered,
        median_package_offered: result.median_package_offered
    };
}


const getProviderListMetaInfo = (list) => {

    let meta_keywords = [];
    let locations = [];
    for (let provider of list) {
        meta_keywords.push(provider.title);

        if (provider.contact_details.city) {
            locations.push(provider.contact_details.city);
        }
        // if(provider.contact_details.state)
        // {
        //     locations.push(provider.contact_details.state);
        // }
        if (provider.contact_details.country) {
            locations.push(provider.contact_details.country);
        }
    }

    locations = locations.filter((x, i, a) => a.indexOf(x) == i)

    meta_keywords = [...meta_keywords, ...locations, ...EXTRA_KEYWORDS_PROVIDER_LIST];

    if (meta_keywords.length > 0) {
        meta_keywords = [...new Set(meta_keywords)];
        meta_keywords = meta_keywords.join(", ");
    }

    return { meta_title: TITLE_PROVIDER_LIST, meta_keywords: meta_keywords, meta_description: DESCRIPTION_PROVIDER_LIST };

}

const getPartnerMetaInfo = (result) => {
    try {
        let meta_description = '';
        let meta_keywords = [];
        const meta_title = getPartnerMetaTitle(result.name);

        if (result.meta_description) {
            meta_description = result.meta_description;
            meta_description = meta_description.replace(/{name}/g, result.name)
        }
        else {
            meta_description = getPartnerMetaDescription(result.name);
        }

        let awards = [];

        if (result.awards && result.awards.length > 0) {
            for (let award of result.awards) {
                awards.push(award.name);
            }
        }
        if (result.meta_keywords) {
            meta_keywords = result.meta_keywords;
            meta_keywords = meta_keywords.replace(/{awards}/g, awards)
            meta_keywords = meta_keywords.replace(/{extra_keywords}/g, EXTRA_KEYWORDS_PARTNER.join(", "))
        }
        else {
            meta_keywords = [result.name];
            meta_keywords = [...meta_keywords, ...awards];
            meta_keywords = [...meta_keywords, ...EXTRA_KEYWORDS_PARTNER];

            if (meta_keywords.length > 0) {
                meta_keywords = [...new Set(meta_keywords)];
                meta_keywords = meta_keywords.join(", ");
            }
        }

        return { meta_title: meta_title, meta_description: meta_description, meta_keywords: meta_keywords };
    } catch (error) {
        console.log("error for partner meta description")
        return { meta_title: meta_title, meta_description: result.meta_description, meta_keywords: result.meta_keywords };
    }
}



const getArticleListMetaInfo = (result) => {
    let meta_keywords = [];
    let author_names = [];
    let tags = [];
    let categories = [];

    for (article of result) {

        if (!article._source.categories) article._source.categories = [];
        categories = [...categories, ...article._source.categories];
        author_names.push(`${article._source.author_first_name} ${article._source.author_last_name}`);
        if (article._source.tags && article._source.tags.length > 0) {
            tags = [...tags, ...article._source.tags];
        }
    }

    categories = categories.filter((x, i, a) => a.indexOf(x) == i);
    author_names = author_names.filter((x, i, a) => a.indexOf(x) == i);
    tags = tags.filter((x, i, a) => a.indexOf(x) == i);

    meta_keywords = [...meta_keywords, ...categories, ...author_names, ...tags, ...EXTRA_KEYWORDS_ARTICLE_LIST];
    if (meta_keywords.length > 0) {
        meta_keywords = [...new Set(meta_keywords)];
        meta_keywords = meta_keywords.join(", ");
    }
    return {
        meta_title: TITLE_ARTICLE_LIST,
        meta_description: DESCRIPTION_ARTICLE_LIST,
        meta_keywords: meta_keywords
    }

}

const generateMetaInfo = async (page, result, list) => {
    let meta_information = null;
    let meta_keywords = null;
    let meta_title = null;
    let meta_description = null;

    result.meta_description = (result.meta_description)? result.meta_description : ''
    result.meta_keywords = (result.meta_keywords)? result.meta_keywords : ''
    
    switch (page) {
        case 'LEARN_CONTENT':
            if(result.partner_name)
            {
                meta_title = `${result.title} | ${result.partner_name}`;
            }
            else{
                meta_title = `${result.title}`;
            }
           
            meta_information = {
                meta_title: meta_title,
                meta_description: await generateCourseMetaDescription(result),
                meta_keywords: await generateCourseMetaKeywords(result)               
            }
            break;
        case 'LEARN_CONTENT_LIST':
            meta_information = getLearnContentListMetaInfo(result);
            break;
        case 'LEARN_PATH':
            meta_title = `${result.title} | Learn Path | ${process.env.SITE_URL_FOR_META_DATA || 'Careervira.com'}`

            meta_information = {
                meta_title: meta_title,
                meta_description: result.meta_description || '',
                meta_keywords: result.meta_keywords || ''     
            }
            break;
         case 'AUTHOR':
                meta_title = `${result.firstname} ${result.lastname} | Author | ${process.env.SITE_URL_FOR_META_DATA || 'Careervira.com'}`
                let bio = ''
                if(result.bio)
                {
                    bio = result.bio.replace(/<[^>]*>?/gm, "");
                    let position = bio.indexOf(".")
                    if (position > 0) {
                        bio = bio.substring(0, position);
                    }
                }
                meta_information = {
                    meta_title: meta_title,
                    meta_description: bio || '',
                    meta_keywords: ''     
                }                
            break;            
        case 'LEARN_PATH_LIST':
                meta_information = {
                    meta_title : `Top Learn paths in ${new Date().getFullYear()} | Careervira`,
                    meta_description: 'Find top Learn paths, degrees and certifications here. See our comprehensive collection of management, software, finance and big data courses from top Institutes and Partners. Start learning now.',
                    meta_keywords: 'online courses, learning courses, paid courses, degrees, certifications, offline courses, instructor courses, courses near me, top courses' 
                };
                break;
        case 'PROVIDER':
            meta_information = getProviderMetaInfo(result);
            break;
        case 'PROVIDER_LIST':
            meta_information = getProviderListMetaInfo(list);
            break;

        case 'PARTNER':
            meta_information = getPartnerMetaInfo(result);
            break;

        case 'ARTICLE':
            meta_title = `${result.title} | ${process.env.SITE_URL_FOR_META_DATA}`;
            let short_description =  result.title
            if (result.short_description) {
               let  short_description = result.short_description;
                let position = short_description.indexOf(".")
                if (position > 0) {
                    short_description = short_description.substring(0, position);
                }
            }
            else if(result.content)
            {
                short_description = result.content.replace(/<[^>]*>?/gm, "");
                let position = short_description.indexOf(".")
                if (position > 0) {
                    short_description = short_description.substring(0, position);
                }
            }
            else
            {
                short_description = result.title
            }

            if (result.meta_description) {
                meta_description = result.meta_description.replace(/{short_description}/g, short_description)
            }
            else 
            meta_description = short_description                
            

            if (result.meta_keywords) {
                result.meta_keywords = result.meta_keywords.replace(/{title}/g, result.title)
                if (result.categories && result.categories.length > 0) {
                    result.meta_keywords = result.meta_keywords.replace(/{categories}/g, result.categories.join(", "))
                }
                else {
                    result.meta_keywords = result.meta_keywords.replace(/{categories}/g, '')
                }
                if (result.article_sub_categories && result.article_sub_categories.length > 0) {
                    result.meta_keywords = result.meta_keywords.replace(/{sub_categories}/g, result.article_sub_categories.join(", "))
                }
                else {
                    result.meta_keywords = result.meta_keywords.replace(/{sub_categories}/g, '')
                }
                if (result.article_topics && result.article_topics.length > 0) {
                    result.meta_keywords = result.meta_keywords.replace(/{topics}/g, result.article_topics.join(", "))
                }
                else {
                    result.meta_keywords = result.meta_keywords.replace(/{topics}/g, '')
                }
                if (result.tags && result.tags.length > 0) {
                    result.meta_keywords = result.meta_keywords.replace(/{tags}/g, result.tags.join(", "))
                }
                else {
                    result.meta_keywords = result.meta_keywords.replace(/{tags}/g, '')
                }

                result.meta_keywords = result.meta_keywords.replace(/{author_names}/g, `${result.author_first_name} ${result.author_last_name}`)
                result.meta_keywords = result.meta_keywords.replace(/{extra_keywords}/g, EXTRA_KEYWORDS_ARTICLE.join(", "))
                meta_keywords = result.meta_keywords
            }
            else {
                keywords = [result.title]
                if (result.categories) {
                    keywords = [...keywords, ...result.categories];
                }
                keywords.push(`${result.author_first_name} ${result.author_last_name}`);
                keywords = [...keywords, ...result.tags];
                keywords = [...keywords, ...EXTRA_KEYWORDS_ARTICLE];

                if (keywords.length > 0) {
                    keywords = [...new Set(keywords)];
                    meta_keywords = keywords.join(", ");
                }
            }
            meta_information = {
                meta_title: meta_title,
                meta_description: meta_description,
                meta_keywords: meta_keywords
            }
            break;
        case 'ARTICLE_LIST':
            meta_information = getArticleListMetaInfo(result);
            break;
        case 'LEARN_GUIDE':
            meta_title = `${result.title} | ${process.env.SITE_URL_FOR_META_DATA}`;
            if (result.article_job_roles && result.article_job_roles.length > 0) {
                result.meta_description = result.meta_description.replace(/{role}/g, result.article_job_roles[0])
            }
            else {
                result.meta_description = result.meta_description.replace(/{role}/g, result.title)
            }
            if (result.soft_skills_skills && result.soft_skills_skills.length > 0) {
                soft_skills_skills = result.soft_skills_skills.map(skill => skill.default_display_label)
                result.meta_description = result.meta_description.replace(/{skills}/g, soft_skills_skills.join(', '))
            }
            else {
                result.meta_description = result.meta_description.replace(/{skills}/g, 'soft skills and tecnical skills')
            }

            result.meta_keywords = result.meta_keywords.replace(/{title}/g, result.title)
            if (result.categories) {
                result.meta_keywords = result.meta_keywords.replace(/{categories}/g, result.categories)
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{categories}/g, '')
            }
            if (result.article_sub_categories) {
                result.meta_keywords = result.meta_keywords.replace(/{sub_categories}/g, result.article_sub_categories)
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{sub_categories}/g, '')
            }
            if (result.article_topics) {
                result.meta_keywords = result.meta_keywords.replace(/{topics}/g, result.article_topics)
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{topics}/g, '')
            }
            if (result.tags && result.tags.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{tags}/g, result.tags.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{tags}/g, '')
            }

            result.meta_keywords = result.meta_keywords.replace(/{author_names}/g, `${result.author_first_name} ${result.author_last_name}`)
            result.meta_keywords = result.meta_keywords.replace(/{extra_keywords}/g, EXTRA_KEYWORDS_ARTICLE.join(", "))

            meta_information = {
                meta_title: meta_title,
                meta_description: result.meta_description,
                meta_keywords: result.meta_keywords
            }

            break;
        case 'CAREER_GUIDE':
            meta_title = `${result.title} | ${process.env.SITE_URL_FOR_META_DATA}`;
            if (result.article_job_roles && result.article_job_roles.length > 0) {
                result.meta_description = result.meta_description.replace(/{role}/g, result.article_job_roles[0])
            }
            else {
                result.meta_description = result.meta_description.replace(/{role}/g, result.title)
            }
            if (result.soft_skills_skills && result.soft_skills_skills.length > 0) {
                soft_skills_skills = result.soft_skills_skills.map(skill => skill.default_display_label)
                result.meta_description = result.meta_description.replace(/{skills}/g, soft_skills_skills.join(', '))
            }
            else {
                result.meta_description = result.meta_description.replace(/{skills}/g, 'soft skills and tecnical skills')
            }


            result.meta_keywords = result.meta_keywords.replace(/{title}/g, result.title)
            if (result.categories && result.categories.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{categories}/g, result.categories.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{categories}/g, '')
            }
            if (result.article_sub_categories && result.article_sub_categories.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{sub_categories}/g, result.article_sub_categories.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{sub_categories}/g, '')
            }
            if (result.article_topics && result.article_topics.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{topics}/g, result.article_topics.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{topics}/g, '')
            }
            if (result.tags && result.tags.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{tags}/g, result.tags.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{tags}/g, '')
            }

            result.meta_keywords = result.meta_keywords.replace(/{author_names}/g, `${result.author_first_name} ${result.author_last_name}`)
            result.meta_keywords = result.meta_keywords.replace(/{extra_keywords}/g, EXTRA_KEYWORDS_ARTICLE.join(", "))
            meta_keywords = result.meta_keywords

            meta_information = {
                meta_title: meta_title,
                meta_description: result.meta_description,
                meta_keywords: result.meta_keywords
            }

            break;
        case 'LEARN_ADVICE':
            meta_title = `${result.title} | ${process.env.SITE_URL_FOR_META_DATA}`;
            if (result.article_topics && result.article_topics.length > 0) {
                result.meta_description = result.meta_description.replace(/{topics}/g, result.article_topics[0])
            }
            else {
                result.meta_description = result.meta_description.replace(/{topics}/g, result.title)
            }

            result.meta_keywords = result.meta_keywords.replace(/{title}/g, result.title)
            if (result.categories && result.categories.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{categories}/g, result.categories.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{categories}/g, '')
            }
            if (result.article_sub_categories && result.article_sub_categories.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{sub_categories}/g, result.article_sub_categories.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{sub_categories}/g, '')
            }
            if (result.article_topics && result.article_topics.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{topics}/g, result.article_topics.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{topics}/g, '')
            }
            if (result.tags && result.tags.length > 0) {
                result.meta_keywords = result.meta_keywords.replace(/{tags}/g, result.tags.join(", "))
            }
            else {
                result.meta_keywords = result.meta_keywords.replace(/{tags}/g, '')
            }

            result.meta_keywords = result.meta_keywords.replace(/{author_names}/g, `${result.author_first_name} ${result.author_last_name}`)
            result.meta_keywords = result.meta_keywords.replace(/{extra_keywords}/g, EXTRA_KEYWORDS_ARTICLE.join(", "))
            meta_keywords = result.meta_keywords

            meta_information = {
                meta_title: meta_title,
                meta_description: result.meta_description,
                meta_keywords: result.meta_keywords
            }

            break;
        case 'HOME_PAGE':
            meta_information = {
                meta_title: 'Careervira: Discover courses from top global institutes for professionals',
                meta_description: (result.meta_description) ? result.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_keywords) ? result.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'ADVICE_PAGE':
            meta_information = {
                meta_title: 'Advice by Careervira: learn guide, career guide and learning advice from experts',
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'SECTION_PAGE':
            meta_information = {
                meta_title: `${result.default_display_label} | Careervira | Careervira.com`,
                meta_description: (result.meta_description) ? result.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_keywords) ? result.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'ABOUT_US':
            meta_information = {
                meta_title: `About us | Careervira | Careervira.com`,
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'LEADERSHIP':
            meta_information = {
                meta_title: `Leadership | Careervira | Careervira.com`,
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'TEAM':
            meta_information = {
                meta_title: `Team | Careervira | Careervira.com`,
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'CAREER':
            meta_information = {
                meta_title: `Career | Careervira | Careervira.com`,
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'TERMS_AND_CONDITION':
            meta_information = {
                meta_title: `Terms and condition | Careervira | Careervira.com`,
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'PRIVACY_POLICY':
            meta_information = {
                meta_title: `Privacy policy | Careervira | Careervira.com`,
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'LEARNERS':
            meta_information = {
                meta_title: `Learners | Careervira | Careervira.com`,
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'PARTNER_WITH_US':
            meta_information = {
                meta_title: `Partner with us | Careervira | Careervira.com`,
                meta_description: (result.meta_information.meta_description) ? result.meta_information.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_information.meta_keywords) ? result.meta_information.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
        case 'INSTITUTE_HOME_PAGE':
            meta_information = {
                meta_title: `Top Institutes | Careervira | Careervira.com`,
                meta_description: (result.meta_description) ? result.meta_description : defaultLearnContentMetaInfo.meta_description,
                meta_keywords: (result.meta_keywords) ? result.meta_keywords : defaultLearnContentMetaInfo.meta_keywords
            }
            break;
            


        default:
            break;
    }
    meta_information.meta_keywords = meta_information.meta_keywords.replace(/, ,/g, ',')
    meta_information.meta_keywords = meta_information.meta_keywords.replace(/ ,/g, ',')
    meta_information.meta_keywords = meta_information.meta_keywords.replace(/,,/g, ',')


    return meta_information;
}



module.exports = {
    generateMetaInfo
}