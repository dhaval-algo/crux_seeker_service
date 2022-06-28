const elasticService = require("../services/elasticService");

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


const defaultLearnContentMetaInfo = {
    meta_description: "Find top courses, degrees and certifications here. See our comprehensive collection of management, software, finance and big data courses from top Institutes and Partners like Edureka, Simpliv LLC and many more. Start learning now. Search and compare courses before you buy.",
    meta_title: "List of over 10000 courses , degrees and certifications from top institutes and providers | Careervira | Careervira.com"
};

const getPartnerMetaDescription = (partnerName) => {

    return `Careervira has courses from top institutes and learning partners like ${partnerName}. Select the best course, degree or certifications for you from our learning platform.`;
}
const getTrendingNowMetaDescription = (title) => {

    return `Browse the best ${title} offered by Careervira and choose the best program and institute that fits your specifications. `;
}

const getPartnerMetaTitle = (partnerName)=>{

    return `${partnerName} | Top partners from Careervira`
}

const generateMetaDescription = async (result) => {
    result.meta_description = "{title} {learn_type} by {partner_name} and upskill your career by acquiring skills {skills} with Careervira. {call_for_action}"
    try{
        const actions = {
            "subscribe_now":"Subscribe Now!",
            "want_more_information":"Want more information? Call Us Now.",
            "visit_us_at_careervira":"Visit us at Careervira.",
            "join_us_now":"Join Us Now!",
            "click_here_for_details":"Click here for details.",
            "enroll_now":"Enroll Now!"
        }
        const max_char_count = 160
        let format = result.meta_description
        const title = result.title
        const learn_type = result.learn_type
        const partner = result.partner_name
        const skills = result.skills
        const action = result.call_for_action 

        format = format.replace(/{title}/g, '\"'+title+'\"')
        format = format.replace(/{learn_type}/g, '\"'+learn_type+'\"')
        format = format.replace(/{partner_name}/g, '\"'+partner+'\"')
        if(result.call_for_action){
            format = format.replace(/{call_for_action}/g, actions[action])
        }else{
            format = format.replace(/{call_for_action}/g, '')
        }
        let skill_string = "";
        if(skills.length > 0){
            skill_string += "like ";
            for(let skill of skills){
                skill_string = skill_string + skill + ","; 
            }
            skill_string = skill_string.slice(0, -1);
            skill_string += " etc"
        }
        
        format = format.replace(/{skills}/g, skill_string)
        
        let count = countCheck(format);
        if(count>max_char_count){
            if(result.call_for_action){
                let re = new RegExp(actions[action],"g");
                format = format.replace(re, '')
            }
        }
        
        for(let i = skills.length-1;i >= 0;i--){
            let re = new RegExp(","+skills[i],"g");
            let recount = countCheck(format);
            if(recount > max_char_count){
                format = format.replace(re, '')
            }else{
                break
            }
        }

        return format;
    }catch(err){
        console.log("err")
        return result.meta_description
    }
}

const getLearnContentListMetaInfo = (result) => {

    let meta_description = null;
    let meta_keywords = [];
    let meta_title = null;

    {
        let categories = [];
        let sub_categories = [];
        let topics = [];

         for (let hits of result.hits) {
                let course = hits._source;
                if(course.topics && course.topics.length > 0)
                {
                    categories = [...categories, ...course.categories];
                    sub_categories = [...sub_categories, ...course.sub_categories];
                    topics = [...topics, ...course.topics];
                }
            }

        if(topics && topics.length > 0)
        {
            categories = categories.filter((x, i, a) => a.indexOf(x) == i)
            sub_categories = sub_categories.filter((x, i, a) => a.indexOf(x) == i)
            topics = topics.filter((x, i, a) => a.indexOf(x) == i)
        }


        if (result.page_details && result.page_details.pageType) {

            if (result.page_details.pageType === 'default') {
                if(topics &&topics.length > 0)
                {
                    meta_keywords = [...meta_keywords, ...categories, ...sub_categories, ...topics];
                }
                meta_keywords.push(...EXTRA_KEYWORDS_LEARN_CONTENT_LIST);
                meta_description = defaultLearnContentMetaInfo.meta_description;
                meta_title = defaultLearnContentMetaInfo.meta_title;
            }
            else {

                if (result.meta_information && result.meta_information.meta_keywords) {
                    meta_keywords = result.meta_information.meta_keywords.split(',')
                }
                else {

                    if(topics &&topics.length > 0)
                    {
                        meta_keywords = [...meta_keywords, ...categories, ...sub_categories, ...topics];
                    }
                    meta_keywords.push(...EXTRA_KEYWORDS_LEARN_CONTENT_LIST);

                }

                if (result.meta_information && result.meta_information.meta_description) {
                    // meta_description = result.meta_information.meta_description;
                    meta_description = generateMetaDescription(result.meta_information.meta_description)
                }

                else {
                    meta_description = defaultLearnContentMetaInfo.meta_description;
                }

                meta_title = `Top ${result.page_details.label} Courses in ${new Date().getFullYear()} | Careervira`;
            }

        }

        if (meta_keywords.length > 0) {
            meta_keywords = [...new Set(meta_keywords)];
            meta_keywords = meta_keywords.join(", ");
        }

    }


    return { meta_title: meta_title, meta_description: meta_description, meta_keywords: meta_keywords };

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

    if (!result.meta_description) {
        let course_count = (result.course_count) ? result.course_count : 0
        meta_description = `${result.name}, ${location} has over ${course_count} courses.`;
        let program_names_str = null;
        let study_modes_names_str = null;
        if (result.programs) {
            program_names_str = result.programs.join(", ");
        }
        if (result.study_modes) {
            study_modes_names_str = result.study_modes.join(", ");
        }


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

    }


    if (result.meta_keywords) {
        meta_keywords = result.meta_keywords;
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
    let meta_description = '';
    let meta_keywords = [];
    const meta_title = getPartnerMetaTitle(result.name);

    if (result.meta_description) {
        meta_description = result.meta_description;
    }
    else {
        meta_description = getPartnerMetaDescription(result.name);
    }

    if (result.meta_keywords) {
        meta_keywords = result.meta_keywords;
    }
    else {

        let awards = [];
        let courses_names = [];

        meta_keywords = [result.name];
        if (result.awards && result.awards.length > 0) {
            for (let award of result.awards) {
                awards.push(award.name);
            }
        }

        if (result.courses.list && result.courses.list.length > 0) {
            for (let course of result.courses.list) {
                courses_names.push(course.title);
            }
        }

        meta_keywords = [...meta_keywords, ...awards, ...courses_names];
        meta_keywords = [...meta_keywords, ...EXTRA_KEYWORDS_PARTNER];

        if (meta_keywords.length > 0) {
            meta_keywords = [...new Set(meta_keywords)];
            meta_keywords = meta_keywords.join(", ");
        }
    }
    return { meta_title:meta_title,meta_description: meta_description, meta_keywords: meta_keywords };
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
        tags = [...tags, ...article._source.tags];
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


const getTrendingNowMetaInfo = async (result) => {
    meta_description = getTrendingNowMetaDescription(result.title);
    let courses = [];
    if (result.type == "Learn_content") {
        if (result.learn_contents) {
            for (learn_content of result.learn_contents) {
                courses.push(learn_content.title);
            }
        }
        if (courses.length > 0) {

            const meta_course_description = courses.join(", ");
            meta_description += meta_course_description + `. Choose the right program for you.`
        }
    }
    else if (result.type == "Institute") {
        if (result.institutes) {
            let instituteId = []
            for (institute of result.institutes) {
                instituteId.push(institute.id);
            }
            let institutes = [];
            let query = {
                "bool": {
                    "must": [
                        { term: { "status.keyword": 'approved' } }
                    ],
                    //"filter": []
                }
            };
            query.bool.must.push(
                {
                    "terms": {
                        "id": instituteId
                    }
                }
            )

            let institutes_hits = await elasticService.search('provider', query);
            for (hit of institutes_hits.hits) {
                institutes.push(hit._source.name)
            }
            if (institutes.length > 0) {
                let meta_institutes_description = institutes.join(", ");
                meta_description += meta_institutes_description + `. Choose the right program for you.`
            }
        }

    }
    
    return { meta_description: meta_description };


}



module.exports = {
    getLearnContentListMetaInfo,
    getProviderMetaInfo,
    getPartnerMetaInfo,
    getProviderListMetaInfo,
    getArticleListMetaInfo,
    getTrendingNowMetaInfo
}