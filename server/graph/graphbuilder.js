    export function buildGraph(careers, universities, exams) {
    const graph = {};

    careers.forEach((career) => {
        graph[career.name] = {
        degrees: career.degrees,
        exams: career.exams,
        universities: career.universities,
        };
    });

    return graph;
    }