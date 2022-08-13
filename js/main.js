document.querySelector('#getButton').addEventListener('click', apiRequest) //add event listener to the button

async function apiRequest() { //async function to make the request
    const alienName = document.querySelector('input').value //get the value of the input
    try { //try to make the request
        const res = await fetch(`https://star-trek-aliens-api-backend.herokuapp.com/api/${alienName}`) //make the request
        const data = await res.json() //get the data
        console.log(data); //log the data

        document.getElementById('alienName').innerText = data.speciesName //set the text of the h1
        document.getElementById('alienWorld').innerText = data.homeworld
        document.getElementById('alienFeatures').innerText = data.features
        document.getElementById('alienFacts').innerText = data.interestingFact
        document.getElementById('alienExamples').innerText = data.notableExamples
        document.getElementById('alienImage').src = data.image
        document.getElementById('alienCaption').innerText = data.speciesName
    } catch (error) { //if the request fails
        console.error(error) //log the error
    }
}
