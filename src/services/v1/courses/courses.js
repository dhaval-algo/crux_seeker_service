const getCourses = (req,res) => {
    let courses = [
        {"id":1, "name":"data science"},
        {"id":2, "name":"data science 2"},
        {"id":3, "name":"data science 3"}
    ]
    return res.status(200).json({success:true,data:{courses}})
}

module.exports = {getCourses}