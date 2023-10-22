let currentTaskId = null;

function createTask(event) {
    event.stopPropagation();
    let name = document.getElementById("task-name").value;
    let dueDate = document.getElementById("due-date").value;

    fetch('/task/new', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: name,
            due_date: dueDate,
        }),
    })
    .then((response) => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error("Error: " + response.statusText);
        }
    })
    .then((responseJson) => {
        console.log(responseJson.message);
        location.reload();
    })
    .catch((error) => {
        console.log("Error:", error);
    });
}

function getCurrentTaskId(element) {
    // Set 'currentTaskId' when a task is clicked
    currentTaskId = element.dataset.taskId;

    // Remove the active-task class from all tasks
    const allTasks = document.querySelectorAll(".task-name");
    allTasks.forEach((task) => {
        task.classList.remove("active-task");
    });

    // Add the active-task class to the clicked task
    element.classList.add("active-task");
    // Show subtasks when a task is selected
    toggleSubtasks(currentTaskId);
}

// Store the value of the select task and make the other tasks content invisible
function toggleSubtasks(currentTaskId) {
    const subtaskForm = document.getElementById(`subtask-form-${currentTaskId}`);
    const subtaskList = document.getElementById(`subtask-list-${currentTaskId}`);
    const subtaskCount = document.querySelector(`.subtask-count.task-${currentTaskId}`);

    if (subtaskForm) {
        subtaskForm.classList.toggle("subtask-hidden");
        subtaskList.classList.toggle("subtask-hidden");
        subtaskCount.classList.toggle("subtask-hidden");

        const allTaskElements = document.querySelectorAll(".task-name");
        allTaskElements.forEach((element) => {
            const taskId = element.getAttribute("data-task-id");
            if (taskId !== currentTaskId) {
                const otherSubtaskForm = document.getElementById(`subtask-form-${taskId}`);
                const otherSubtaskList = document.getElementById(`subtask-list-${taskId}`);
                const otherSubtaskCount = document.querySelector(`.subtask-count.task-${taskId}`);

                otherSubtaskForm.classList.add("subtask-hidden");
                otherSubtaskList.classList.add("subtask-hidden");
                otherSubtaskCount.classList.add("subtask-hidden");
            }
        });

        localStorage.setItem("currentTaskState", JSON.stringify({
            taskId: currentTaskId,
            state: subtaskForm.classList.contains("subtask-hidden") ? "collapsed" : "expanded",
        }));

        updateRemainingSubtasks();
    }
}


function createSubtask(currentTaskId, event) {
    event.stopPropagation();
    const subtaskName = document.getElementById(
    `subtask-name-${currentTaskId}`
    ).value;

    fetch('/subtask/new', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: subtaskName,
            task_id: currentTaskId, // Include the task ID in the request
        }),
    })
    .then((response) => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Error: ' + response.statusText);
        }
    })
    .then((responseJson) => {
        console.log(responseJson);
        location.reload();
    })
    .catch((error) => {
        console.log('Error:', error);
    });
}

// Task completion status toggle
function toggleTaskStatus(subtaskId) {
    const label = document.getElementById(`subtask-name-${subtaskId}`);
    const checkbox = document.getElementById(`status-check-${subtaskId}`);
    
    if (checkbox.checked) {
        label.classList.add('completed');
    } else {
        label.classList.remove('completed');
    }
    fetch('/toggle/' + subtaskId, {
        method: 'GET'
    })
    .then(response => {
        if (response.ok) {
            // Task status successfully toggled
            updateRemainingSubtasks();
        } else {
            throw new Error('Error: ' + response.statusText);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

// Add task toggle
function toggleT() {
    const formToggle = document.querySelector(".show-form");
    formToggle.classList.toggle("subtask-hidden");
}

document.addEventListener("DOMContentLoaded", () => {
    // Get the date input element
    const dueDateInput = document.getElementById("due-date");

    // Get the current date in the format "yyyy-mm-dd"
    const currentDate = new Date().toISOString().split("T")[0];

    // Set the min attribute to the current date
    dueDateInput.setAttribute("min", currentDate);

    // Call the function to calculate and update remaining days
    calculateRemainingDays();

    updateRemainingSubtasks();

    // When the page loads, retrieve and apply the state for the current task
    const currentTaskState = localStorage.getItem("currentTaskState");
    if (currentTaskState) {
        const { taskId } = JSON.parse(currentTaskState);
        // Apply the state for the current task
        toggleSubtasks(taskId);

        // Apply the active-task class to the last active task
        const lastActiveTask = document.querySelector(
        `.task-name[data-task-id="${taskId}"]`
        );
        lastActiveTask.classList.add("active-task");
    }


});

//Edit task
function editTaskName(currentTaskId) {
    const taskNameElement = document.querySelector(
        `[data-task-id="${currentTaskId}"]`
    );
    const editDiv = document.querySelector(`#editing-${currentTaskId}`);
    const taskNameText = taskNameElement.textContent;

    const editInput = editDiv.querySelector(".edit-input");
    const saveButton = editDiv.querySelector(".save-button");

    editInput.value = taskNameText;

    // Toggle visibility of edit input and save button
    editDiv.classList.toggle("subtask-hidden");

    // When the "Save" button is clicked, send a request to update the task name
    saveButton.onclick = function () {
        const newName = editInput.value;

        fetch(`/update_task_name/${currentTaskId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ new_name: newName }),
        })
        .then((response) => {
            if (response.ok) {
            return response.json();
            } else {
            throw new Error("Error: " + response.statusText);
            }
        })
        .then((responseJson) => {
            console.log(responseJson);
            taskNameElement.textContent = newName;
            editDiv.classList.add("subtask-hidden");
        })
        .catch((error) => {
            console.log("Error:", error);
        });
    };
}

//Edit subtask
// Edit subtask name
function editSubtaskName(subtaskId) {
    const editDiv = document.querySelector(`#editing-${subtaskId}`);
    const editInput = editDiv.querySelector(".edit-input");

    const subtaskNameElement = document.querySelector(
        `#subtask-name-${subtaskId}`
    );
    const subtaskNameText = subtaskNameElement.textContent.trim();

    editInput.value = subtaskNameText;

    // Toggle visibility of edit input and save button
    editDiv.classList.toggle("subtask-hidden");
}

// Save subtask name
function saveTaskName(subtaskId) {
    const editDiv = document.querySelector(`#editing-${subtaskId}`);
    const editInput = editDiv.querySelector(".edit-input");

    const newName = editInput.value;

    // Send a request to update the subtask name
    fetch(`/update_subtask_name/${subtaskId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ new_name: newName }),
    })
    .then((response) => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error("Error: " + response.statusText);
        }
    })
    .then((responseJson) => {
        console.log(responseJson);
        const subtaskNameElement = document.querySelector(
        `#subtask-name-${subtaskId}`
        );
        subtaskNameElement.textContent = newName;
        editDiv.classList.add("subtask-hidden");
    })
    .catch((error) => {
        console.log("Error:", error);
    });
}

// Delete task
function deleteTask(currentTaskId) {
    // Confirm with the user before deleting
    const confirmed = confirm("Are you sure you want to delete this task?");
    
    if (confirmed) {
        fetch(`/delete_task/${currentTaskId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        })
        .then((response) => {
            if (response.ok) {
                // Reload the page after successful deletion
                location.reload();
            } else {
                throw new Error("Error: " + response.statusText);
            }
        })
        .catch((error) => {
            console.log("Error:", error);
        });
    }
}

// Delete subtask
function deleteSubtask(subtaskId) {
    // Confirm with the user before deleting
    const confirmed = confirm("Are you sure you want to delete this subtask?");
    
    if (confirmed) {
        fetch(`/delete_subtask/${subtaskId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        })
        .then((response) => {
            if (response.ok) {
              // Reload the page after successful deletion
                location.reload();
            } else {
                throw new Error("Error: " + response.statusText);
            }
        })
        .catch((error) => {
            console.log("Error:", error);
        });
    }
}

function searchTasks() {
    const searchMonthYear = document.getElementById("search-input").value;
    const tasks = document.querySelectorAll(".Task-container .search");

    tasks.forEach((task) => {
        const creationDate = task
        .querySelector(".date-interval")
        .textContent.split(" - ")[0];

        const [day, month, year] = creationDate.split("/").map(Number);
        const taskMonthYear = `${year}-${String(month).padStart(2, "0")}`;

        task.style.display = taskMonthYear === searchMonthYear ? "block" : "none";
    });
    }

function clearSearch() {
    const searchInput = document.getElementById("search-input");
    searchInput.value = ""; // Clear the input field

    const tasks = document.querySelectorAll(".Task-container .search");
    tasks.forEach((task) => {
        task.style.display = "block"; // Reset the display style
    });
}


function calculateRemainingDays() {
    const tasks = document.querySelectorAll(".Task-container .task-list");

    tasks.forEach((task) => {
        const dateElement = task.querySelector(".date-interval");
        const dueDateText = dateElement.textContent.split(" - ")[1];
        const [day, month, year] = dueDateText.split("/");

        // Subtract 1 from the month value since JavaScript months are zero-based
        const dueDate = new Date(year, month - 1, day, 23, 59, 59);

        const currentDate = new Date();
        const timeDifference = dueDate - currentDate;

        const remainingDays = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
        if (remainingDays <= 1) {
            dateElement.textContent += ` (${remainingDays} day)`;
        } else {
            dateElement.textContent += ` (${remainingDays} days)`;
        }


        if (remainingDays <= 0) {
            // Disable the task and subtasks
            task.classList.add("disabled");

            // Disable all anchor elements within the task except the delete anchor
            const anchors = task.querySelectorAll(".anchor");
            anchors.forEach((anchor) => {
                if (!anchor.classList.contains("delete-anchor")) {
                    anchor.onclick = (event) => event.preventDefault();
                    anchor.style.pointerEvents = "none";
                }
            });

            // Disable all input elements within the task
            const inputs = task.querySelectorAll("input");
            inputs.forEach((input) => {
                input.disabled = true;
            });
            // Find and disable the associated subtasks
            const taskId = task.querySelector(".task-name").dataset.taskId;
            const subtaskContainer = document.getElementById(
                `subtask-content-${taskId}`
            );

            subtaskContainer.classList.add("subtask-hidden");
            // Disable all anchor elements within the subtask container
            const subtaskAnchors = subtaskContainer.querySelectorAll(".anchor-s");
            subtaskAnchors.forEach((anchor) => {
                anchor.onclick = (event) => event.preventDefault();
                anchor.style.pointerEvents = "none";
            });

            // Disable all input elements within the subtask container
            const subtaskInputs = subtaskContainer.querySelectorAll("input");
            subtaskInputs.forEach((input) => {
                input.disabled = true;
            });

            // Disable the button within the subtask container
            const subtaskButtons = subtaskContainer.querySelectorAll("button");
            subtaskButtons.forEach((button) => {
                button.disabled = true;
            });
        }
    });
}

function updateRemainingSubtasks() {
    const tasks = document.querySelectorAll(".Task-container .task-list");

    tasks.forEach((task) => {
        const taskId = task
        .querySelector(".task-name")
        .getAttribute("data-task-id");
        const subtaskContent = document.getElementById(`subtask-content-${taskId}`);
        const subtasks = subtaskContent.querySelectorAll(".subtask-checkbox");
        const totalSubtasks = subtasks.length;
        let completedSubtasks = 0;

        subtasks.forEach((subtask) => {
        if (subtask.checked) {
            completedSubtasks++;
        }
        });

        const remainingSubtasks = totalSubtasks - completedSubtasks;

        // Display the number of remaining subtasks
        const subtaskCountElement = subtaskContent.querySelector(".subtask-count");
        const taskNameElement = task.querySelector(".task-name");
        
        if (subtaskCountElement) {
        if (remainingSubtasks <= 1) {
            subtaskCountElement.textContent = `${remainingSubtasks} Subtask remaining`;
        } else {
            subtaskCountElement.textContent = `${remainingSubtasks} Subtasks remaining`;
        }
        }

        // Add or remove line-through based on remainingSubtasks
        if (remainingSubtasks === 0) {
        taskNameElement.style.textDecoration = "line-through";
        } else {
        taskNameElement.style.textDecoration = "none";
        }
    });
}
