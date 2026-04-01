    export function mergeAIResponses(responses) {
    const careers = [];

    responses.forEach((res) => {
        if (res.includes("Cybersecurity")) careers.push("Cybersecurity Engineer");
        if (res.includes("Robotics")) careers.push("Robotics Engineer");
    });

    return [...new Set(careers)];
    }