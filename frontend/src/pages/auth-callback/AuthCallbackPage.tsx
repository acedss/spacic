import { axiosInstance } from '@/lib/axios'
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const AuthCallbackPage = () => {

    const navigate = useNavigate()
    useEffect(() => {
        const sycnUser = async () => {
            // Handle authentication callback logic here
            try {
                const data = await axiosInstance.get('/')
                console.log(data)
            } catch (error) {
                console.error('Error during authentication callback:', error)
            } finally {
                navigate("/")
                console.log("Navigated to home page")
            }
        }
        sycnUser()
    }, [navigate])

    return (
        <div>AuthCallbackPage</div>
    )
}
export default AuthCallbackPage