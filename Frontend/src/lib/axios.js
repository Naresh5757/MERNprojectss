import axios from "axios";

const axiosInstances=axios.create({
    // baseURL:"https://mernproject-f7fp.onrender.com/api",
    baseURL:"http://localhost:5000/api",
    withCredentials:true,//send cookies to the server
})

export default axiosInstances