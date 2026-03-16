import React from "react";

class ErrorBoundary extends
React.Component {
    constructor(props) {
        super(props);
        this.state = {hasError:false};
    }

    static getDerivedStateFromError(error) {
        return {hasError:true};
    }

    componentDidCatch(error, info){
        console.error("Error Boundary caught  an error:", error, info);
    }

    render(){
        if(this.state.hasError){
            return(
                <div style={{padding:"20px", textAlign: "center"}}>
                    <h2>Something went wrong !</h2>
                    <p>Please try refreshing the page or contact support</p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;